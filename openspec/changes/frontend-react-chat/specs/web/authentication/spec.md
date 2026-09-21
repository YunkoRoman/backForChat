# Spec Delta

## Purpose

Lets a person log in, register, and stay signed in across page loads without their session tokens ever being readable by injected JavaScript.

## ADDED Requirements

### Requirement: Login and registration forms
The system SHALL provide a login form (email, password) and a registration form (email, password, display name), each validated client-side before submission, and SHALL show the server's error message on failure without crashing the page.

#### Scenario: Successful login navigates to the app
- **WHEN** a person submits valid credentials on the login form
- **THEN** the app stores the returned access token in memory and navigates to the chat view

#### Scenario: Invalid credentials show an inline error
- **WHEN** a person submits incorrect credentials
- **THEN** the form shows the server's error message and the person remains on the login page

#### Scenario: Client-side validation blocks an obviously invalid submission
- **WHEN** a person submits the registration form with an invalid email format or a password below the minimum length
- **THEN** the form shows a validation error without sending a request to the server

### Requirement: Session persists across page loads without exposing the refresh token to JavaScript
The system SHALL hold the access token only in memory (never in `localStorage`, `sessionStorage`, or a JS-readable cookie). On app load, the system SHALL attempt a silent session restore by calling the refresh endpoint (which reads the httpOnly cookie); on success, the person lands in the chat view without re-entering credentials, and on failure, the person sees the login page.

#### Scenario: Reloading the page keeps the person signed in
- **WHEN** a signed-in person reloads the page
- **THEN** the app silently restores the session and shows the chat view, without a visible login flash for a valid session

#### Scenario: An expired or absent session falls back to login
- **WHEN** a person with no valid session (or an expired one) loads the app
- **THEN** the app shows the login page

### Requirement: Expired access token is transparently refreshed
The system SHALL, when an API call fails with 401, attempt exactly one silent refresh and retry the original call; if the refresh also fails, the system SHALL sign the person out and show the login page.

#### Scenario: A mid-session 401 is recovered transparently
- **WHEN** an API call fails with 401 because the access token expired
- **THEN** the app refreshes the session and retries the call without the person noticing, succeeding if the refresh succeeds

#### Scenario: A failed refresh signs the person out
- **WHEN** the silent refresh itself fails
- **THEN** the app clears the in-memory session and shows the login page

### Requirement: Logout ends the session
The system SHALL let a signed-in person log out, calling the server's logout endpoint and clearing the in-memory access token, returning them to the login page.

#### Scenario: Logout returns to the login page
- **WHEN** a signed-in person logs out
- **THEN** the app clears its session state and shows the login page, and a subsequent page load does not silently restore the old session
