# Design

## Context

See `proposal.md` - Why. The backend (`apps/api`) is done and stable: REST under `/api/v1`, a Socket.IO gateway with JWT-verified handshake identity, and cookie-based refresh tokens (see `openspec/changes/backend-ddd-rewrite/`). This design covers only the new `apps/web` client. Visual direction (palette, type, layout) was approved by the user from a mockup artifact before this design was written; see Decisions below for the concrete tokens.

## Goals / Non-Goals

**Goals:**
- A working SPA covering every scenario in `specs/web/authentication`, `specs/web/conversations`, `specs/web/messaging`
- Session handling that never puts the refresh token in reach of JS, matching the backend's httpOnly-cookie contract
- A realtime layer that stays in sync with REST-fetched state without ad-hoc polling

**Non-Goals:**
- Dark mode, mobile-native app, offline support - none requested
- File/image attachments, message search - out of scope per the backend's own feature scope
- Server-side rendering - a client-only SPA is sufficient for an internal/stage-release chat tool

## Decisions

### Framework & build: Vite + React + TypeScript
Considered Next.js (adds SSR/routing machinery this SPA doesn't need) and plain Vite+React (chosen). Vite gives fast dev/build with no framework opinions we'd have to work around; React Router handles the three-route surface (`/login`, `/register`, `/chat`) directly.

### Data fetching: TanStack Query over hand-rolled fetch+state
Every REST resource here (conversations, message pages, user directory) benefits from cache-by-key, background refetch, and optimistic-update primitives that TanStack Query provides out of the box. Hand-rolling this (useState/useEffect per resource) was rejected as more code for a worse result - it's exactly the kind of cross-cutting concern a library should own.

### Realtime: a single Socket.IO client in a React context, feeding the Query cache
One socket connection for the whole app (not per-conversation), opened once the person is authenticated, closed on logout. Incoming events (`message:new`, `presence:update`, `typing:update`, `message:read:update`) write directly into the relevant TanStack Query cache entries (`queryClient.setQueryData`) rather than triggering a refetch - this keeps the UI update synchronous with the event instead of racing a network round-trip, which matters for a "feels realtime" chat UI.

### Auth transport: access token in memory, refresh token in the existing httpOnly cookie
The backend already sets the refresh token as an httpOnly cookie (see `backend-ddd-rewrite`'s cookie fix) - the frontend does nothing with it directly except let the browser send it automatically (`fetch(..., { credentials: 'include' })`). The access token lives in a React context (module-level variable read by the fetch wrapper), never in `localStorage`/`sessionStorage`, so an XSS payload reading browser storage gets nothing useful. On app load and on any 401, the fetch wrapper calls `/api/v1/auth/refresh` once and retries; a second failure signs out. The Socket.IO client authenticates with the same in-memory access token via `io(url, { auth: { token } })`, matching the gateway's existing handshake contract - when the access token is refreshed, the socket reconnects with the new one (Socket.IO's `auth` can be a function re-evaluated on each (re)connect attempt).

### Component/state organization: feature folders, not DDD layers
Backend DDD layering (domain/application/infrastructure) solves a problem - keeping business rules independent of frameworks and swappable persistence - that a browser SPA rendering server-computed state doesn't have. Structuring `apps/web/src` by feature (`features/auth`, `features/conversations`, `features/chat`) instead keeps related UI, hooks, and API calls colocated, which is what actually helps navigating a React codebase.

### Styling: Tailwind CSS, hand-built components (no component library)
The approved mockup's look (warm-neutral palette, terracotta accent `#C1552C`, Fraunces display + Manrope UI type, soft-fill active states instead of left-border cards, circular initials avatars instead of a placeholder-image library) doesn't match any off-the-shelf component library's defaults closely enough to save time by starting from one - Tailwind utility classes plus a handful of small, purpose-built components (Avatar, MessageBubble, ConversationRow, etc.) get there directly. Tailwind config carries the approved tokens (colors, font families) as named values so they're used consistently rather than re-typed as hex literals throughout.

### Forms & validation: react-hook-form + zod
Matches the backend's own validation story (it already uses `zod` for env config) and gives cheap client-side validation (matching `specs/web/authentication`'s "blocks an obviously invalid submission" requirement) without a heavier form framework.

## Risks / Trade-offs

- **[Risk]** An in-memory-only access token means a hard page reload always pays one round-trip (silent refresh) before the app is usable → **Mitigation**: accepted; this is the direct consequence of not storing it in JS-readable storage, which was the whole point of the cookie change. A brief loading state on first paint is the honest cost.
- **[Risk]** A single global socket connection means a reconnect (e.g. after a network blip) needs to re-establish `conversation:join` for whatever conversation is currently open, or presence/typing/message delivery silently stop working for it → **Mitigation**: the socket context re-joins the active conversation's room on every `connect` event (including reconnects), not just the first one.
- **[Trade-off]** No component library means more UI code to write and maintain than adopting one → accepted, given the approved visual direction doesn't map cleanly onto an existing library's defaults and the app's UI surface is small (three screens).

## Migration Plan

1. Scaffold `apps/web` (Vite + React + TS) into the existing npm workspace; verify it builds and runs against nothing (empty shell) first.
2. Build the API/socket client layer and auth context (silent refresh, in-memory token) - nothing else depends on backend data yet, so this can be verified against the already-running `apps/api` directly.
3. Build `web/authentication` (login/register pages) - first vertical slice that's actually usable end-to-end against the real backend.
4. Build `web/conversations` (sidebar, new conversation/group, add member).
5. Build `web/messaging` (chat view, history, send, realtime, typing, read receipts, presence) - the largest slice, built last since it depends on both prior slices being real.
6. No automated test suite is being added for `apps/web` in this change (out of scope - the backend carries the test burden for correctness; the frontend is verified by running it against the real API, per this project's "start the dev server and use the feature in a browser" verification norm). Rollback: this is a net-new app in a new directory: revert the branch, nothing else to undo.
