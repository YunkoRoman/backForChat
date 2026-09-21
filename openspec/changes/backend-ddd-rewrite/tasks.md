# Tasks

## 1. Monorepo & tooling setup

- [x] 1.1 Create `apps/api` as a new NestJS project (Nest CLI or manual scaffold) with TypeScript strict mode; verify `npm run build` succeeds with no emitted errors
- [x] 1.2 Set up root workspace tooling (npm/pnpm workspaces covering `apps/api` and the future `apps/web`); verify `npm install` from repo root resolves `apps/api`'s dependencies
- [x] 1.3 Add `ConfigModule` with a Zod (or `class-validator`-based) env schema (`MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RABBITMQ_URL`, `FRONTEND_ORIGIN`, `PORT`); verify the app fails fast with a clear error when a required var is missing
- [x] 1.4 Add `.env.example` with placeholder values for every var from 1.3 and confirm `.env` is in `.gitignore`
- [x] 1.5 Add ESLint + Prettier config for `apps/api`; verify `npm run lint` runs clean on the scaffold

## 2. Shared kernel

- [x] 2.1 Implement `DomainError` base class and a `Result<T, E>`-style outcome type in `apps/api/src/shared-kernel/`; verify unit tests cover success and failure construction
- [x] 2.2 Define repository interface conventions (e.g. a base `Repository<T, Id>` interface) used by every module's `application` layer; verify identity/messaging/presence modules can import it without importing Nest or Mongoose into `domain/`

## 3. Identity — domain & application

- [x] 3.1 Implement `User` aggregate, `Email` value object (format validation), `Credentials` value object (wraps a password hash, never a plaintext password) in `identity/domain`; verify unit tests reject an invalid email and confirm `Credentials` has no plaintext accessor
- [x] 3.2 Implement `RegisterUser` use case (application layer) calling a `UserRepository` interface and a `PasswordHasher` interface; verify unit test rejects a duplicate email and a weak password per `specs/identity/authentication`
- [x] 3.3 Implement `LoginUser` use case issuing access + refresh tokens via a `TokenService` interface; verify unit test returns the same generic error for wrong password and unknown email
- [x] 3.4 Implement `RefreshSession` use case with rotation and reuse-detection (revoke all sessions on reused-token detection); verify unit tests for rotate-success, reuse-detected, and revoke-all-on-reuse
- [x] 3.5 Implement `LogoutUser` use case revoking the current refresh token; verify unit test confirms the token can no longer be exchanged after logout

## 4. Identity — infrastructure

- [x] 4.1 Implement Mongoose schemas `UserDocument` (email unique index, `passwordHash` with `select: false`) and `RefreshTokenDocument` (`userId`, `tokenHash`, `expiresAt`, `replacedByToken`) implementing the repository interfaces from section 3; verify a uniqueness-constraint integration test on email
- [x] 4.2 Implement `argon2id` adapter for the `PasswordHasher` interface; verify a round-trip hash/verify unit test and that the stored value is never the plaintext input
- [x] 4.3 Implement JWT adapter for `TokenService` using `@nestjs/jwt` (15 min access token, longer-lived refresh token) reading secrets from `ConfigModule`; verify a unit test that an expired token fails verification
- [x] 4.4 Implement `AuthController` (`POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout`) with DTOs validated by `class-validator`; verify e2e tests (via `mongodb-memory-server` + supertest) covering every scenario in `specs/identity/authentication`
- [x] 4.5 Implement global `JwtAuthGuard` (registered via `APP_GUARD`) and `@Public()` decorator; verify e2e test that a protected route without a token returns 401 and a `@Public()` route does not
- [x] 4.6 Implement global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`; verify e2e test that an extra/unexpected field (e.g. a `$ne` object) in a request body is rejected rather than reaching a query
- [x] 4.7 Add `@nestjs/throttler` with a stricter limit on `/auth/login`; verify e2e test that exceeding the limit returns a rate-limit error per `specs/identity/authentication`

## 5. Identity — user directory

- [x] 5.1 Implement `ListUsers` use case and `UsersController` (`GET /api/v1/users`), excluding the requester, paginated; verify e2e tests for both scenarios in `specs/identity/user-directory`

## 6. Messaging — domain & application

- [x] 6.1 Implement `Conversation` aggregate (type `1:1`/`group`, members) and `Message` entity in `messaging/domain`; verify unit tests enforce the group-needs-2+-members rule
- [x] 6.2 Implement `CreateOneToOneConversation` (reuse-if-exists) and `CreateGroupConversation` use cases; verify unit tests for both scenarios in `specs/messaging/conversations`
- [x] 6.3 Implement `AddMemberToConversation` use case (member-only, group-only); verify unit tests for all three scenarios in `specs/messaging/conversations`
- [x] 6.4 Implement `SendMessage` use case (member-only, non-empty, max-length) and `GetMessageHistory` use case (cursor pagination, member-only); verify unit tests for every scenario in `specs/messaging/messages`

## 7. Messaging — infrastructure

- [x] 7.1 Implement Mongoose schemas `ConversationDocument`, `MembershipDocument` (`conversationId`+`userId` unique index, `lastReadMessageId`), `MessageDocument` (index on `conversationId`+`createdAt`); verify an integration test that duplicate membership insert is rejected
- [x] 7.2 Implement `ConversationsController` (`POST /api/v1/conversations`, `GET /api/v1/conversations`, `POST /api/v1/conversations/:id/members`); verify e2e tests covering `specs/messaging/conversations`
- [x] 7.3 Implement `MessagesController` (`GET /api/v1/conversations/:id/messages`) for history; verify e2e tests covering the history-retrieval scenarios in `specs/messaging/messages`
- [x] 7.4 Implement the messaging `WebSocketGateway` with JWT-verified handshake (derives `userId` only from the verified token, never a client payload), handling `conversation:join`, `conversation:leave`, `message:send` → emits `message:new`; verify a WS e2e test (socket.io-client) that a connection without a valid token is refused, and that a sent message is delivered to other connected members

## 8. Read receipts

- [x] 8.1 Implement `MarkConversationRead` use case updating `lastReadMessageId` on `Membership` (member-only, message-must-belong-to-conversation); verify unit tests for both scenarios in `specs/messaging/read-receipts`
- [x] 8.2 Wire `message:read` WS event to the use case and emit `message:read:update` to other connected members; verify a WS e2e test that other members receive the updated read position

## 9. Presence

- [x] 9.1 Implement an in-process presence tracker (connected-socket count per user) in `presence/infrastructure`; verify unit test that status flips to offline only after the last connection for a user ends
- [x] 9.2 Wire presence to the shared WS gateway's connect/disconnect lifecycle, emitting `presence:update` to members of shared conversations; verify a WS e2e test for both online and offline scenarios in `specs/presence/presence-tracking`
- [x] 9.3 Implement `typing:start`/`typing:stop` WS handlers with a server-side timeout that clears the indicator if no stop signal arrives; verify a WS e2e test for the auto-clear scenario in `specs/presence/presence-tracking`

## 10. Event bus (RabbitMQ)

- [ ] 10.1 Add `@golevelup/nestjs-rabbitmq`, declare the `chat.events` topic exchange, and implement a thin `EventPublisher` port in `shared-kernel` so `domain`/`application` layers depend on an interface, not the library; verify a unit test with a fake publisher confirms use cases call it after (not before) the repository save completes
- [ ] 10.2 Wire `identity`, `messaging`, `presence` use cases to publish `user.registered`, `message.sent`, `conversation.created`, `member.added`, `user.online`/`user.offline` after their respective persistence step; verify an integration test (real RabbitMQ via docker-compose in CI) that each event is published with the expected routing key and payload shape
- [ ] 10.3 Implement a `notifications` consumer module subscribed to the relevant routing keys (logging-only stub for this change, ready for future email/push work); verify an integration test that a published event is received and logged exactly once even if redelivered (idempotency per `specs/platform/event-bus`)
- [ ] 10.4 Verify the triggering action (e.g. `message:send`) still succeeds when RabbitMQ is unreachable (stop the broker in a test, assert the REST/WS action still returns success and the failure is logged), per `specs/platform/event-bus`

## 11. Cross-cutting hardening

- [x] 11.1 Add `helmet()` and a `FRONTEND_ORIGIN`-driven CORS allowlist (replacing the old open `cors()` + manual `Access-Control-Allow-Origin` header pair); verify an e2e test that a disallowed origin is rejected
- [x] 11.2 Add a global exception filter that returns sanitized error responses (no stack traces) when `NODE_ENV=production`; verify a test asserting the response body excludes stack traces in that mode
- [x] 11.3 Add structured request/error logging (e.g. `pino`) with a correlation id per request; verify a manual check that a request's logs are correlated end-to-end

## 12. Docker Compose & deployment

- [x] 12.1 Write `apps/api/Dockerfile` (multi-stage build); verify `docker build` succeeds and the image starts against a local `.env` — **verification caveat**: this environment's Docker daemon routes registry pulls through a proxy (`http.docker.internal:3128`) that is not reachable here, so `docker pull`/`docker build` hang indefinitely on the base image and a real `docker build` could not be run. Verified instead by replicating each stage's exact file set and commands outside Docker: `npm ci --workspace=api` + `npm run build` against an isolated copy of the real build context (root `package.json`/`package-lock.json` + `apps/api` only, no `apps/web`) succeeded and produced `dist/main.js`; the runtime stage's COPY set (root `node_modules` + `apps/api/dist` + package.json files, nothing else) was reconstructed and `node apps/api/dist/main.js` booted the full app and answered `GET /api/v1` with 200. This process caught and fixed a real bug: the Dockerfile copied `apps/api/node_modules`, which doesn't exist under npm workspaces (everything hoists to the root) — would have failed every build.
- [x] 12.1b Write `apps/web/Dockerfile` (multi-stage build: `vite build` then serve the static output, e.g. via nginx); verify `docker build` succeeds and the resulting container serves the app — same registry-proxy caveat as 12.1; verified the build stage the same way (isolated `apps/web`-only context, `npm ci --workspace=web` + `npm run build` succeeded, produced `dist/index.html`). The nginx runtime stage only copies static `dist/` output (no node_modules path issue).
- [x] 12.2 Write root `docker-compose.yml` with `mongo`, `rabbitmq` (management UI on `:15672`), `api`, and `web` (apps/web, built and served, e.g. via nginx — the frontend didn't exist when this line was first written, it does now) services, healthchecks, and named volumes; verify `docker compose up` brings up a working API and a working frontend reachable on their published ports, frontend able to reach the API — `docker compose up` itself blocked on the same registry-proxy issue; `docker compose --env-file .env.docker config` validates the full file (services, healthcheck conditions, env substitution, port mappings) with no errors. Host ports remapped off the defaults (api 13000, mongo 27018, rabbitmq 5673/15673) since this machine already had a local mongod, RabbitMQ, and dev server bound to the standard ports throughout this project's development.
- [x] 12.3 Document local dev setup (`.env` from `.env.example`, `docker compose up`, seed/test commands) in `apps/api/README.md`

## 13. CI

- [x] 13.1 Add a GitHub Actions workflow running install → lint → typecheck → unit tests on every push/PR; verify the workflow passes on the `feature/ddd-rewrite` branch
- [ ] 13.2 Extend the workflow with an e2e job that boots `mongodb-memory-server` and a RabbitMQ service container, then runs the e2e suite (sections 4, 5, 7, 8, 9, 10); verify the job passes in CI, not just locally — **Note**: workflow is complete and verified locally, but final CI verification requires pushing to GitHub to trigger the actual Actions run (requires user approval to push)

## 14. Cutover

- [ ] 14.1 Run `openspec validate backend-ddd-rewrite --type change --strict` and confirm every scenario in `specs/` has a passing corresponding test from sections 3-10
- [ ] 14.2 Delete `legacy/` once 14.1 passes and this change is archived; verify `apps/api` is the only backend in the repo afterward
