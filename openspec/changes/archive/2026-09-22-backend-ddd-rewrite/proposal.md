# Proposal

## Why

The current backend (`legacy/`, Express + Socket.IO from 2021) cannot go to a stage release: passwords are stored and compared in plaintext (NoSQL-injection-prone `findOne({email, password})`), JWT secrets are hardcoded in source, Socket.IO trusts a client-supplied `userId` with no verification (lets any client impersonate any user and read their private messages), and one controller (`messageController.js`) is dead code that throws on every call. There is also no frontend, no group chat, no presence, and no read receipts. This change replaces the backend with a NestJS/DDD implementation that closes these holes and adds the missing chat features needed for a usable product.

## What Changes

- **BREAKING**: replace the entire Express backend (`legacy/`) with a NestJS backend at `apps/api`, organized as DDD modules (`identity`, `messaging`, `presence`) with `domain` / `application` / `infrastructure` layers per module
- **BREAKING**: replace ad-hoc per-controller token checks with a global `JwtAuthGuard` (`@Public()` opt-out) and global `ValidationPipe({whitelist, forbidNonWhitelisted})`
- Replace plaintext password storage with `argon2id` hashing
- Replace hardcoded JWT secrets with env-validated config (fail-fast on startup if missing)
- Replace client-supplied Socket.IO `userId` with server-verified JWT in the handshake
- Add refresh-token rotation (hashed, stored per-device, revocable) instead of a single long-lived auth token
- Add group conversations (not just 1:1), presence + typing indicators, and read receipts (via `lastReadMessageId` on membership, not per-message arrays)
- Add a RabbitMQ integration-event bus (`chat.events` topic exchange) so bounded contexts communicate via published events (`message.sent`, `conversation.created`, `member.added`, `user.registered`, `user.online`/`user.offline`) instead of direct cross-module calls, and so group-message fan-out doesn't block the request path
- Add rate limiting (`@nestjs/throttler`, stricter on login), `helmet()`, and a CORS allowlist driven by `FRONTEND_ORIGIN` instead of an open `cors()`
- Add Docker Compose for stage deployment (`mongo`, `rabbitmq`, `api`, `web`)
- Old `legacy/` code is kept only as a reference during migration and removed once `apps/api` covers its behavior

## Capabilities

### New Capabilities
- `identity/authentication`: registration, login, JWT access + rotating refresh tokens, logout/session revocation, argon2id password hashing
- `identity/user-directory`: authenticated listing of other users (for starting a conversation)
- `messaging/conversations`: creating and listing 1:1 and group conversations, adding members to a group
- `messaging/messages`: sending messages (REST + WebSocket), paginated message history
- `messaging/read-receipts`: tracking and broadcasting how far each member has read a conversation
- `presence/presence-tracking`: online/offline status and typing indicators over WebSocket
- `platform/event-bus`: RabbitMQ-backed publication of cross-context integration events

### Modified Capabilities
(none — greenfield relative to `openspec/specs`, which is currently empty; the old `legacy/` Express code predates this change's spec tracking and is not itself a tracked capability)

## Impact

- **Code**: new `apps/api` (NestJS) and `apps/web` (React) under a monorepo root; `legacy/` retained temporarily then deleted at the end of the migration
- **APIs**: entirely new REST surface under `/api/v1` and a new Socket.IO v4 event contract; old routes (`/auth`, `/message`, `/registration`, `/users`) are replaced, not kept for compatibility (no external consumers exist)
- **Dependencies added**: `@nestjs/*`, `argon2`, `@nestjs/jwt`, `class-validator`/`class-transformer`, `@nestjs/throttler`, `helmet`, `@golevelup/nestjs-rabbitmq`, `mongoose` (kept), `socket.io` v4 (upgrade from v2)
- **Systems**: adds RabbitMQ alongside existing MongoDB; adds Docker Compose for local/stage deployment; CI (GitHub Actions) runs lint/typecheck/unit/e2e/build
