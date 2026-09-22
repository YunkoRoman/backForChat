# identity/user-directory Specification

## Purpose

Lets an authenticated person discover other registered users so they can start a conversation with them.

## Requirements

### Requirement: List other users
The system SHALL, for an authenticated request, return a paginated list of registered users excluding the requester. The system SHALL reject the request if the caller is not authenticated.

#### Scenario: Authenticated user lists others
- **WHEN** an authenticated person requests the user list
- **THEN** the system returns other registered users, paginated, and never includes the requester themselves

#### Scenario: Unauthenticated request rejected
- **WHEN** an unauthenticated request asks for the user list
- **THEN** the system rejects the request
