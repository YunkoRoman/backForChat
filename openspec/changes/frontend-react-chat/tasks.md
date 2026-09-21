# Tasks

## 1. Scaffold

- [x] 1.1 Scaffold `apps/web` with Vite (React + TypeScript template), add it to the root npm workspace; verify `npm run build` (in `apps/web`) succeeds on the empty scaffold
- [x] 1.2 Install and configure Tailwind CSS; add the approved design tokens (colors: `bg`, `surface`, `text`, `text-secondary`, `border`, `accent #C1552C`, `accent-hover #A8461F`, `accent-soft #FBE7DC`, `online #3F9142`; font families: Fraunces for display, Manrope for UI) to the Tailwind config as named theme values; verify a test element using `bg-accent` and `font-display` renders with the right computed styles
- [x] 1.3 Add `react-router`, set up routes `/login`, `/register`, `/chat` with a placeholder page each; verify navigating between them in the browser works
- [x] 1.4 Add ESLint + Prettier config for `apps/web` (or reuse root config if one exists); verify lint runs clean on the scaffold

## 2. API & socket client layer

- [x] 2.1 Implement a `fetchApi` wrapper (`credentials: 'include'`, base URL from an env var, JSON handling) with a 401 interceptor that calls the refresh endpoint once and retries the original request, signing out on a second failure; verify by manually hitting a protected endpoint with an expired token against the running `apps/api` and observing the transparent retry in the network tab
- [x] 2.2 Implement an `AuthContext` holding the in-memory access token and current user, with `login`, `register`, `logout`, and an app-load `restoreSession` (calls refresh) function; verify a manual reload of `/chat` while signed in restores the session before rendering the chat view
- [x] 2.3 Implement a `SocketContext`: connects once authenticated (`auth: { token }` re-evaluated per connection attempt), exposes `emit`/`on` helpers, re-joins the currently-active conversation's room on every `connect` event (initial and reconnect); verify in the browser console that a manual server restart triggers a reconnect and the room rejoin fires
- [x] 2.4 Wire TanStack Query's `QueryClientProvider` at the app root; verify a trivial query (e.g. `GET /api/v1/users/me` if available, else the user directory) round-trips against the real backend

## 3. Authentication UI

- [ ] 3.1 Build the login page (react-hook-form + zod validation) per `specs/web/authentication`; verify all three login scenarios (success navigates to chat, wrong credentials show inline error, client-side validation blocks bad input) manually against the running backend
- [ ] 3.2 Build the registration page; verify its scenarios the same way, including the weak-password and duplicate-email server error surfacing correctly
- [ ] 3.3 Build a protected-route wrapper that redirects to `/login` when there is no session (after `restoreSession` resolves) and away from `/login`/`/register` when there is one; verify by reloading `/chat` both signed-in and signed-out
- [ ] 3.4 Build the logout action (in the chat shell's header, see section 4) wired to `AuthContext.logout`; verify it returns to `/login` and that reloading afterward does not silently restore the old session

## 4. Conversations UI

- [ ] 4.1 Build the chat shell layout (sidebar + main panel) matching the approved mockup's structure; verify it renders at the two viewport sizes it'll realistically be used at (i.e. a normal laptop width, and check it doesn't break narrower)
- [ ] 4.2 Build the conversation list (sidebar): fetch via TanStack Query, show name/avatar/presence dot/last-message-preview/unread indicator, most-recently-active first, selecting one sets it active; verify against real seeded conversations from the backend
- [ ] 4.3 Build the new-conversation picker (user directory, searchable) wired to `POST /api/v1/conversations` with `type: '1:1'`; verify both the new-conversation and reuse-existing-conversation scenarios from `specs/web/conversations` against the real backend (the backend already implements reuse - confirm the picker surfaces the same conversation both times)
- [ ] 4.4 Build the new-group flow (name + multi-select from directory) wired to `POST /api/v1/conversations` with `type: 'group'`; verify the too-few-members validation error shows client-side before any request is sent
- [ ] 4.5 Build the add-member action on a group conversation's header (hidden entirely for 1:1 conversations); verify both scenarios from `specs/web/conversations`

## 5. Messaging UI

- [ ] 5.1 Build the message history view: fetch the latest page via `GET /api/v1/conversations/:id/messages`, render newest at the bottom, own vs. others' bubbles styled per the mockup; verify against a conversation with real seeded messages
- [ ] 5.2 Add scroll-to-top pagination (fetch and prepend the next older page via the cursor, preserving scroll position); verify by seeding a conversation with more messages than one page and scrolling up
- [ ] 5.3 Build the composer: emits `message:send` over the socket on submit, clears on send, disabled/no-op on empty input, shows an error state on a `message:send:error` event; verify the send-then-appear round trip against the real backend, and verify the empty-message no-op
- [ ] 5.4 Handle incoming `message:new`: append to the open conversation's message list if it matches, otherwise update that conversation's sidebar unread state and reorder it to the top; verify both paths with two browser sessions (or two browser profiles) logged in as different users
- [ ] 5.5 Build the typing indicator: emit `typing:start`/`typing:stop` from composer input activity, render incoming `typing:update` in the open conversation; verify it appears and clears (both on explicit stop and on the server's own timeout) with two sessions
- [ ] 5.6 Build read receipts: send a read update when the active conversation's latest loaded message becomes visible, render incoming `message:read:update` as a read marker on the person's own sent messages; verify with two sessions that marking read on one side updates the sender's read marker on the other
- [ ] 5.7 Build presence display: render `presence:update` events as the online dot in the sidebar and the conversation header; verify by connecting/disconnecting a second session and observing the first session's indicator update live

## 6. End-to-end manual verification

- [ ] 6.1 With `apps/api` running locally (real MongoDB, real RabbitMQ not required since sections 6-9 don't depend on it) and `apps/web`'s dev server running, walk through: register two accounts in two browser profiles, start a 1:1 conversation, exchange messages, confirm realtime delivery/typing/read-receipts/presence all work between the two sessions, create a group with both accounts plus a third, send a group message, add a member. Note and fix anything broken before considering this change done.
