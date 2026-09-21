# Spec Delta

## Purpose

Lets conversation members send text messages and retrieve the message history of conversations they belong to.

## ADDED Requirements

### Requirement: Send a message
The system SHALL allow a member of a conversation to send a text message to it. The system SHALL reject an empty message and a message over the maximum allowed length. The system SHALL reject a send attempt from someone who is not a member of the conversation. The system SHALL deliver a sent message to every currently connected member in real time.

#### Scenario: Message sent and delivered
- **WHEN** a member sends a non-empty message within the length limit
- **THEN** the system persists the message and delivers it in real time to every other currently connected member of the conversation

#### Scenario: Empty message rejected
- **WHEN** a member attempts to send an empty message
- **THEN** the system rejects the send

#### Scenario: Non-member cannot send
- **WHEN** someone who is not a member of the conversation attempts to send a message to it
- **THEN** the system rejects the send

### Requirement: Retrieve message history
The system SHALL return a conversation's messages in reverse-chronological order, paginated by cursor. The system SHALL reject the request if the requester is not a member of the conversation.

#### Scenario: Member retrieves paginated history
- **WHEN** a member requests the message history of their conversation
- **THEN** the system returns messages newest-first with a cursor to fetch the next page

#### Scenario: Non-member cannot retrieve history
- **WHEN** someone who is not a member of the conversation requests its history
- **THEN** the system rejects the request
