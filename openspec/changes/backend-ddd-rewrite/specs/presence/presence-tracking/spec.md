# Spec Delta

## Purpose

Lets users see which of their conversation partners are currently online and whether they are typing right now.

## ADDED Requirements

### Requirement: Online and offline status
The system SHALL mark a user online when they establish an authenticated realtime connection, and offline when their last such connection ends. The system SHALL notify members of the user's shared conversations when their status changes.

#### Scenario: User goes online
- **WHEN** a user establishes their first authenticated realtime connection
- **THEN** the system marks them online and notifies members of conversations they share with that user

#### Scenario: User goes offline
- **WHEN** a user's last authenticated realtime connection ends
- **THEN** the system marks them offline and notifies members of conversations they share with that user

### Requirement: Typing indicator
The system SHALL let a conversation member signal that they are currently typing, and SHALL notify other members of that conversation in real time. The system SHALL automatically clear the indicator after a period of inactivity if no explicit stop signal is sent.

#### Scenario: Typing indicator shown
- **WHEN** a member signals they are typing in a conversation
- **THEN** other currently connected members of that conversation see the typing indicator

#### Scenario: Typing indicator clears automatically
- **WHEN** a member who signaled typing sends no further activity and no explicit stop signal within the timeout period
- **THEN** the system clears the typing indicator for that member
