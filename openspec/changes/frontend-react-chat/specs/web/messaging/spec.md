# Spec Delta

## Purpose

Lets a person read a conversation's history, send messages, see them and others' messages arrive in real time, see typing and read status, and see who's online.

## ADDED Requirements

### Requirement: Message history loads and paginates
The system SHALL load the most recent page of a selected conversation's messages, newest at the bottom, and SHALL load older messages when the person scrolls to the top, using the backend's cursor pagination.

#### Scenario: Opening a conversation shows recent messages
- **WHEN** a person selects a conversation
- **THEN** the chat view shows its most recent messages, newest at the bottom

#### Scenario: Scrolling up loads older messages
- **WHEN** a person scrolls to the top of the currently loaded history
- **THEN** the app fetches and prepends the next older page, without losing scroll position

### Requirement: Sending a message
The system SHALL let a person send a non-empty message to the active conversation over the realtime connection, SHALL clear the composer on send, and SHALL show a clear error state (not a silent failure) if the send is rejected.

#### Scenario: Sending a message appends it to the view
- **WHEN** a person submits a non-empty message
- **THEN** the composer clears and the message appears in the conversation once the server confirms it

#### Scenario: An empty message cannot be submitted
- **WHEN** the composer is empty
- **THEN** the send action is disabled or a no-op

### Requirement: Realtime message delivery
The system SHALL append an incoming `message:new` event to the active conversation's view immediately, without a page reload or manual refresh, when it belongs to the currently open conversation; for a different conversation, it SHALL update that conversation's unread state in the sidebar.

#### Scenario: A message from another connected member appears live
- **WHEN** another member sends a message to the conversation the person currently has open
- **THEN** it appears in the chat view without the person taking any action

#### Scenario: A message in a background conversation updates the sidebar
- **WHEN** a message arrives for a conversation that is not currently open
- **THEN** that conversation's sidebar entry shows an unread indicator and moves to the top of the list

### Requirement: Typing indicator
The system SHALL show a typing indicator in the active conversation when another member is typing, driven by `typing:update` events, and SHALL send `typing:start`/`typing:stop` as the person types and stops.

#### Scenario: Another member's typing is shown
- **WHEN** another member of the open conversation is typing
- **THEN** the chat view shows a typing indicator naming them

#### Scenario: Typing indicator clears when they stop
- **WHEN** the typing member stops (explicit stop or the server's own timeout fires)
- **THEN** the typing indicator disappears

### Requirement: Read receipts
The system SHALL mark the active conversation as read (up to its latest loaded message) when the person views it, and SHALL show other members' read position (e.g. a read marker on the person's own messages) driven by `message:read:update` events.

#### Scenario: Opening a conversation marks it read
- **WHEN** a person opens a conversation and its latest messages are visible
- **THEN** the app sends a read-receipt update for the latest message

#### Scenario: Own message shows the other member's read status
- **WHEN** another member's read position advances past one of the person's own sent messages
- **THEN** that message's read indicator updates to reflect it

### Requirement: Presence display
The system SHALL show whether the other participant(s) of a conversation are currently online, driven by `presence:update` events, both in the sidebar and in the open conversation's header.

#### Scenario: A contact's status updates live
- **WHEN** a 1:1 conversation's other participant connects or disconnects
- **THEN** their presence indicator in the sidebar and chat header updates without a page reload
