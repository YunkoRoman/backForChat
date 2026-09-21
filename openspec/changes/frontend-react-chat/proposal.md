# Proposal

## Why

The backend (`apps/api`, sections 1-9 of `backend-ddd-rewrite` plus the httpOnly-cookie refresh-token fix) now exposes a complete, tested REST + WebSocket surface — auth, user directory, 1:1 and group conversations, realtime messaging, presence, typing indicators, and read receipts — but there is no client. A stage release needs a working, modern-looking chat UI people can actually use.

## What Changes

- Add a new `apps/web` React SPA (Vite + TypeScript) implementing login/register, a conversation sidebar (1:1 + group, presence dots, unread counts), a chat view (paginated history, send, realtime receive, typing indicator, read receipts), and a new-conversation/new-group picker backed by the user directory
- Session handling: access token held in memory only (never persisted), silent re-auth via `POST /api/v1/auth/refresh` (httpOnly cookie) on app load and on a 401
- Realtime: a Socket.IO client wrapped in a React context, authenticated via the same access token, driving live updates for `message:new`, `presence:update`, `typing:update`, `message:read:update`
- Visual direction approved by the user from a mockup: warm-neutral palette, terracotta accent, Fraunces (display) + Manrope (UI) typefaces — no default Bootstrap/Material or generic "AI gradient" look

## Capabilities

### New Capabilities
- `web/authentication`: login/register UI, in-memory access-token session, silent refresh on load and on 401, logout
- `web/conversations`: sidebar list (1:1 + group, presence, unread), new-conversation and new-group creation from the user directory, adding members to an existing group
- `web/messaging`: chat view — paginated message history, sending, realtime message delivery, typing indicator, read receipts, presence display within a conversation

### Modified Capabilities
(none — this change only adds a new frontend against the already-shipped, unmodified backend API)

## Impact

- **Code**: new `apps/web` (React + Vite + TypeScript) added to the existing npm workspace alongside `apps/api`
- **APIs**: consumes the existing `/api/v1/*` REST endpoints and the existing Socket.IO gateway; no backend changes required or made by this change
- **Dependencies added**: `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `socket.io-client`, `react-hook-form`, `zod`, `tailwindcss`, plus their Vite/TypeScript tooling
- **Systems**: `docker-compose.yml` (section 12, not yet built) will need a `web` service later; out of scope for this change, which targets local dev (`vite dev`) against a locally running `apps/api`
