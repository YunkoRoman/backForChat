# messaging/read-receipts Specification

## Purpose

Lets conversation members know which messages the other members have already seen.

## Requirements

### Requirement: Mark a conversation as read
The system SHALL allow a member to mark a conversation as read up to a specific message. The system SHALL reject the request if the requester is not a member of the conversation, or if the given message does not belong to it.

#### Scenario: Member marks conversation read
- **WHEN** a member marks their conversation as read up to a message they have seen
- **THEN** the system records that member's read position at that message

#### Scenario: Non-member cannot mark as read
- **WHEN** someone who is not a member of the conversation attempts to mark it as read
- **THEN** the system rejects the request

### Requirement: Read position is visible to other members
The system SHALL notify other currently connected members in real time when a member's read position advances.

#### Scenario: Other members see updated read position
- **WHEN** a member's read position advances
- **THEN** every other currently connected member of the conversation is notified of the new read position in real time
