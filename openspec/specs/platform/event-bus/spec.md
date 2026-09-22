# platform/event-bus Specification

## Purpose

Lets independently evolving parts of the system react to what happened elsewhere — a message was sent, a user registered — without being directly coupled to the part that caused it.

## Requirements

### Requirement: Events are published only after the triggering change is durable
The system SHALL publish an integration event only after the change that triggered it has been durably persisted, never before or instead of persisting it.

#### Scenario: Event published only after persistence succeeds
- **WHEN** an action that both changes persisted state and publishes an event completes
- **THEN** the persisted state change exists before or at the same time as the published event, never the reverse

### Requirement: Event consumers tolerate duplicate delivery
Because delivery is at-least-once rather than exactly-once, the system SHALL ensure that processing the same event more than once produces the same effect as processing it once.

#### Scenario: Duplicate delivery does not duplicate the effect
- **WHEN** the same event is delivered to a consumer more than once
- **THEN** the observable effect of processing it is the same as if it had been delivered once

### Requirement: Event publication failure does not fail the triggering action
The system SHALL still report success for the user-facing action that triggered an event even if publishing that event temporarily fails, and SHALL record the failure for follow-up.

#### Scenario: User action succeeds despite event bus being unavailable
- **WHEN** the event bus is temporarily unreachable while an action that publishes an event is performed
- **THEN** the triggering action still completes successfully for the caller, and the publication failure is recorded
