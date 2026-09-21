# Spec Delta

## Purpose

Lets users create and manage 1:1 and group conversations with other registered users.

## ADDED Requirements

### Requirement: Create a 1:1 conversation
The system SHALL create a private conversation between the requester and exactly one other registered user. The system SHALL reuse an existing 1:1 conversation between the same two users instead of creating a duplicate.

#### Scenario: New 1:1 conversation created
- **WHEN** a person starts a conversation with another registered user for the first time
- **THEN** the system creates a new 1:1 conversation containing exactly those two users

#### Scenario: Existing 1:1 conversation reused
- **WHEN** a person starts a conversation with a user they already have a 1:1 conversation with
- **THEN** the system returns the existing conversation instead of creating a new one

### Requirement: Create a group conversation
The system SHALL create a group conversation with a name and an initial member list that includes the creator, and SHALL require at least two total members.

#### Scenario: Group conversation created
- **WHEN** a person creates a group with a name and at least one other member
- **THEN** the system creates a group conversation containing the creator and the specified members

#### Scenario: Group creation with too few members rejected
- **WHEN** a person attempts to create a group with no other members
- **THEN** the system rejects the request

### Requirement: List my conversations
The system SHALL return the list of conversations the requester currently belongs to.

#### Scenario: User lists their conversations
- **WHEN** an authenticated person requests their conversation list
- **THEN** the system returns every conversation they are a member of, and no conversation they are not a member of

### Requirement: Add member to a group conversation
The system SHALL allow an existing member of a group conversation to add another registered user to it. The system SHALL reject adding a member to a 1:1 conversation. The system SHALL reject the request if the requester is not a member of the conversation.

#### Scenario: Member added to group
- **WHEN** an existing group member adds a registered user who is not yet a member
- **THEN** the system adds that user to the group and it appears in their conversation list

#### Scenario: Adding a member to a 1:1 conversation rejected
- **WHEN** a member of a 1:1 conversation attempts to add a third person
- **THEN** the system rejects the request

#### Scenario: Non-member cannot add others
- **WHEN** a person who is not a member of a conversation attempts to add someone to it
- **THEN** the system rejects the request
