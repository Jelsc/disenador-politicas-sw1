# Delta for Mobile Client Flow

## ADDED Requirements

### Requirement: Automatic assignment continuation

The system MUST allow the mobile app to resume an in-progress policy assignment or trámite continuation from prior state.

#### Scenario: Resume pending continuation

- GIVEN a pending assignment exists for the client
- WHEN the client opens the app
- THEN the system restores the continuation point and next action

#### Scenario: No continuation exists

- GIVEN no pending assignment exists
- WHEN the client opens the continuation flow
- THEN the system shows the standard start or follow-up entry point

### Requirement: Voice-driven form completion

The system MUST allow clients to complete form fields through guided voice interaction and preserve partial progress.

#### Scenario: Voice fills a field

- GIVEN a form with required fields
- WHEN the client speaks a valid response
- THEN the system maps the response to the appropriate field
- AND saves partial progress

#### Scenario: Interrupted capture is restored

- GIVEN the client stops mid-flow
- WHEN the user returns later
- THEN the system restores the saved form state
