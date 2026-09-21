# Spec Delta

## Purpose

Lets a signed-in person see their conversations, start new ones (1:1 or group) from the directory of other users, and add members to an existing group.

## ADDED Requirements

### Requirement: Conversation list
The system SHALL show the signed-in person's conversations (1:1 and group), each with the other participant's (or group's) name, a live presence indicator for 1:1 conversations, and an unread indicator when the conversation has messages past the person's last-read position. Selecting one shows it in the chat view.

#### Scenario: Conversation list loads on entering the app
- **WHEN** a signed-in person opens the chat view
- **THEN** the sidebar shows their conversations, most-recently-active first

#### Scenario: Selecting a conversation opens it
- **WHEN** a person clicks a conversation in the list
- **THEN** the chat view shows that conversation's message history and becomes the active conversation for sending and realtime updates

### Requirement: Start a new 1:1 conversation from the directory
The system SHALL let a person open a picker listing other registered users (searchable) and start a 1:1 conversation with one of them; if a 1:1 conversation with that user already exists, the system SHALL open the existing one instead of creating a duplicate (matching the backend's reuse behavior).

#### Scenario: Starting a conversation with a new contact
- **WHEN** a person picks a user they have no existing 1:1 conversation with
- **THEN** the app creates the conversation and opens it in the chat view

#### Scenario: Starting a conversation with an existing contact reopens it
- **WHEN** a person picks a user they already have a 1:1 conversation with
- **THEN** the app opens the existing conversation instead of creating a new one

### Requirement: Create a group conversation
The system SHALL let a person create a group conversation by naming it and selecting two or more other users from the directory, and SHALL show a validation error if fewer than the required minimum is selected (matching the backend's 2-total-member minimum).

#### Scenario: Creating a group with a name and members
- **WHEN** a person names a group and selects at least one other member
- **THEN** the app creates the group conversation and opens it in the chat view

#### Scenario: Creating a group with no members is blocked
- **WHEN** a person attempts to create a group with no other members selected
- **THEN** the app shows a validation error without sending a request

### Requirement: Add a member to an existing group
The system SHALL let a member of a group conversation add another user from the directory to it, and SHALL NOT offer this action on a 1:1 conversation.

#### Scenario: Adding a member to a group
- **WHEN** a member of a group conversation picks a user to add
- **THEN** the app adds them and the group's member list updates

#### Scenario: No add-member action on a 1:1 conversation
- **WHEN** a person views a 1:1 conversation
- **THEN** the app does not offer an add-member action for it
