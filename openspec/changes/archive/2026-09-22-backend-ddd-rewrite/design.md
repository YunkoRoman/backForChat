# Design

## Context

See `proposal.md` - Why, for the motivation. In short: the current `legacy/` backend has correctness and security defects (plaintext password comparison, hardcoded JWT secrets, client-trusted socket identity, a controller that crashes on every call) and lacks the domain structure or features needed for a real product. This design starts from an empty `openspec/specs/` tree (no prior tracked capabilities) and targets a fresh NestJS backend at `apps/api`, built alongside (but not blocking) a new React frontend at `apps/web`.

Constraints carried over from user decisions made before this design:
- Stay on MongoDB/Mongoose (no relational migration)
- Backend ships first; the frontend is built against the REST/WS contract this design fixes
- Deployment target is Docker Compose (self-hosted), not a PaaS
- RabbitMQ is required for cross-context integration events and group-message fan-out
- Spec/plan artifacts live in OpenSpec (`openspec/changes/`), not in a separate plan document

## Goals / Non-Goals

**Goals:**
- Give each bounded context (`identity`, `messaging`, `presence`) an isolated domain layer that does not import Nest, Mongoose, or another context's internals
- Close every security defect identified in `legacy/` (see proposal) by construction, not by convention
- Define a stable REST + WebSocket contract the frontend can be built against independently
- Keep the persistence model simple enough to implement and test within this change's scope

**Non-Goals:**
- Horizontal scaling of realtime servers (multi-instance presence/socket fan-out via Redis adapter) - single-instance stage deployment is in scope; multi-instance is a documented future risk, not built here
- File/image attachments, message search - explicitly out of scope per the feature-selection decision
- A full transactional outbox pattern for event publication - at-least-once publish-after-persist is accepted for this change (see Risks)
- Relational (Postgres) migration

## Decisions

### Framework: NestJS over hand-rolled Express + DDD folders
Considered three options: (A) NestJS modules-as-bounded-contexts, (B) Express with a hand-rolled DDD folder structure and no DI framework, (C) Express with a lightweight DI container (Awilix).
Chose **A**. DDD was an explicit requirement, and Nest's module system maps directly onto bounded contexts while providing auth guards, validation pipes, and exception filters as configuration rather than code we'd have to write and re-verify ourselves - the previous codebase's security bugs were exactly this kind of hand-rolled infrastructure code done inconsistently per-controller. B and C both mean re-implementing that infrastructure, reintroducing the same class of risk.

### Layering per module: domain / application / infrastructure
Each of `identity`, `messaging`, `presence` has:
- `domain/`: entities, value objects, domain services - no framework or ORM imports
- `application/`: use-case classes that orchestrate domain objects via repository *interfaces*
- `infrastructure/`: Mongoose schemas/repositories implementing those interfaces, Nest controllers and WebSocket gateways
A `shared-kernel` module holds cross-cutting primitives (`DomainError`, a `Result`-style outcome type, base Value Object helpers, repository interface conventions) with no dependents outside the other modules' domain layers.

### Password hashing: argon2id over bcrypt
argon2id is the current recommended default (memory-hard, resistant to GPU cracking) and has a mature Node binding. bcrypt was considered and rejected only because argon2id is strictly the better current default with no meaningful integration cost difference here.

### Auth: short-lived access token + rotating, revocable refresh token
A single long-lived token (the `legacy/` approach) cannot be revoked short of rotating the shared secret for everyone. Splitting into a 15-minute access token plus a refresh token that rotates on every use, with reuse detection revoking all of that user's sessions, bounds the damage of a leaked token and gives us a real logout. Refresh tokens are stored hashed, never in plaintext, so a database read does not leak usable tokens.

### WebSocket identity: server-verified handshake token
`legacy/socketService` trusted a client-supplied `userId` in a `socket.on('userId', ...)` message - meaning any connected client could claim to be any user and receive their private messages. The new gateway verifies the JWT access token during the Socket.IO handshake and derives `userId` only from the verified token payload; no post-connect client message can set or change it.

### Read receipts: `lastReadMessageId` on membership, not per-message read arrays
Storing `readBy: [...]` on every message does not scale with group size or message volume - every read event would rewrite that array on the hot message-send path. Tracking a single `lastReadMessageId` per (conversation, member) on the `Membership` document is O(1) to update and lets "unread count" and "who has read this" both be computed from a single field. Same approach used by Slack-style systems.

### Cross-context communication: RabbitMQ integration events, publish-after-persist
Contexts publish events (`message.sent`, `conversation.created`, `member.added`, `user.registered`, `user.online`/`offline`) to a `chat.events` topic exchange via `@golevelup/nestjs-rabbitmq`, instead of importing and calling each other's application services directly. This keeps `identity`, `messaging`, `presence` genuinely decoupled and gives group-message fan-out (delivering to potentially many members) a path that doesn't block the request/socket-emit path. Considered a full transactional outbox (write event + entity in the same DB transaction, a separate relay process publishes from the outbox table) for stronger delivery guarantees, but rejected it for this change as disproportionate to a stage-release pet project; publish-after-successful-persist with idempotent consumers is documented as an accepted trade-off (see Risks).

### Validation and injection prevention: global `ValidationPipe` + DTOs
`legacy/services/authUser.service.js` passed `req.body` fields directly into `Model.findOne({ email, password })`, which is a NoSQL-injection vector (a client can submit `{ "$ne": null }` as `password`). Every controller input goes through a `class-validator` DTO under a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, which rejects any field that isn't an explicitly declared, correctly-typed field before it reaches a query.

## Risks / Trade-offs

- **[Risk]** Presence state lives in-process (a `Map`), so it is not shared across multiple `apps/api` instances → **Mitigation**: documented as a single-instance limitation for this stage release; a Redis-backed presence/adapter is the documented next step if horizontal scaling is needed, not built now.
- **[Risk]** Publish-after-persist to RabbitMQ is at-least-once, not exactly-once, and a crash between persist and publish loses that one event → **Mitigation**: every consumer must be idempotent (a spec requirement in `platform/event-bus`); the triggering user action never depends on publish succeeding (also a spec requirement), so the user-visible behavior degrades gracefully rather than failing.
- **[Risk]** Migrating off `legacy/` is a hard cutover (old routes are not kept for compatibility) → **Mitigation**: acceptable because there are no external consumers of the old API; `legacy/` stays in the repo until `apps/api` is verified to cover its behavior, then is deleted.
- **[Trade-off]** argon2id and NestJS add build/runtime dependencies (native bindings, more packages) versus the old minimal Express app → accepted, since the previous minimalism is what let the security defects go unnoticed.

## Migration Plan

1. Stand up `apps/api` alongside `legacy/` (already relocated, not deleted) on the `feature/ddd-rewrite` branch - no production traffic depends on `legacy/` today, so there is no live cutover to sequence.
2. Implement identity → messaging → presence → event-bus wiring, in that dependency order (messaging's fan-out depends on identity's auth; presence depends on the same socket auth path).
3. Bring up `apps/web` against the fixed REST/WS contract once `apps/api` exposes it locally.
4. Verify via the test suite (unit + `mongodb-memory-server`-backed e2e + a RabbitMQ-backed e2e job) before declaring the change ready to archive.
5. Delete `legacy/` in a follow-up commit once `apps/api` is confirmed to cover its behavior; this is not part of this change's `tasks.md` since it's a cleanup step gated on the whole change being done, not a task the implementation depends on.
6. Rollback strategy: revert the `feature/ddd-rewrite` branch merge; `legacy/` remains untouched and mergeable back on its own until deletion happens, so rollback has no data-migration to undo (new Mongo collections are additive, not a schema migration of existing ones).
