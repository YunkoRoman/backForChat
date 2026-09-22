# Spec Delta

## Purpose

Lets a person register an account, prove their identity to use the system, keep a session alive across visits, and end it — without their password ever being stored or exposed in a recoverable form.

## ADDED Requirements

### Requirement: User registration
The system SHALL allow a new person to register with an email, a password, and a display name. The system SHALL reject registration when the email is already registered. The system SHALL reject a password that does not meet a minimum strength policy. The system SHALL NOT store the password in any reversible or plaintext form.

#### Scenario: Successful registration
- **WHEN** a person submits a unique email, a password meeting the strength policy, and a display name
- **THEN** the system creates the account and the password is not retrievable in plaintext by anyone, including operators

#### Scenario: Duplicate email rejected
- **WHEN** a person registers with an email already in use
- **THEN** the system rejects the registration without revealing whether the email exists for other purposes than this explicit error

#### Scenario: Weak password rejected
- **WHEN** a person registers with a password below the minimum strength policy
- **THEN** the system rejects the registration and explains the policy

### Requirement: Login issues an access token and a refresh token
The system SHALL, given a correct email and password, issue a short-lived access token and a longer-lived refresh token. The system SHALL reject an incorrect email or an incorrect password with the same generic error, so an attacker cannot tell which was wrong.

#### Scenario: Successful login
- **WHEN** a person submits the email and password of a registered account
- **THEN** the system issues a new access token and a new refresh token

#### Scenario: Wrong password rejected
- **WHEN** a person submits a registered email with an incorrect password
- **THEN** the system rejects the login with a generic "invalid credentials" error

#### Scenario: Unknown email rejected
- **WHEN** a person submits an email that is not registered
- **THEN** the system rejects the login with the same generic "invalid credentials" error used for a wrong password

### Requirement: Login attempts are rate-limited
The system SHALL limit how many login attempts a given client can make within a time window and SHALL reject further attempts once the limit is exceeded, independent of whether the credentials are correct.

#### Scenario: Excessive login attempts rejected
- **WHEN** a client exceeds the allowed number of login attempts within the time window
- **THEN** the system rejects further login attempts from that client until the window resets, even with correct credentials

### Requirement: Refresh token rotation and reuse detection
The system SHALL allow a valid, unexpired refresh token to be exchanged for a new access token and a new refresh token, invalidating the exchanged refresh token. The system SHALL reject reuse of an already-exchanged refresh token and SHALL revoke all of that user's active sessions when such reuse is detected, since it indicates the refresh token was stolen.

#### Scenario: Refresh rotates the token
- **WHEN** a client presents its current valid refresh token
- **THEN** the system issues a new access token and a new refresh token, and the presented refresh token can no longer be used

#### Scenario: Reused refresh token revokes all sessions
- **WHEN** a client presents a refresh token that was already exchanged once before
- **THEN** the system rejects the request and revokes every active session belonging to that user

### Requirement: Logout revokes the session
The system SHALL allow a person to revoke their current refresh token on demand, ending that session immediately.

#### Scenario: Logout revokes refresh token
- **WHEN** an authenticated person logs out
- **THEN** their refresh token is immediately invalidated and can no longer be exchanged for new tokens

### Requirement: Protected access requires a valid access token
The system SHALL reject any request to a protected resource, or any realtime connection, that does not carry a valid, non-expired access token. The system SHALL derive the caller's identity only from the verified token, never from a value supplied by the client outside the token.

#### Scenario: Missing token rejected
- **WHEN** a request to a protected resource carries no access token
- **THEN** the system rejects the request as unauthenticated

#### Scenario: Expired token rejected
- **WHEN** a request carries an access token past its expiry
- **THEN** the system rejects the request as unauthenticated

#### Scenario: Realtime connection without a valid token is rejected
- **WHEN** a client attempts to open a realtime connection without a valid access token
- **THEN** the system refuses the connection
