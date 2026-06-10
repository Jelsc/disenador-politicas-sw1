# Mobile Client Flow Specification

## Purpose

Support the full citizen flow in Flutter: consultation, initiation, follow-up, forms, documents, signatures, and notifications.

## Requirements

### Requirement: Request initiation

The system MUST allow a client to initiate a trámite request from the mobile app using text or voice.

#### Scenario: New request is started

- GIVEN a mobile user with access to the app
- WHEN the user submits a request description
- THEN the system creates or prepares the trámite initiation flow

### Requirement: Client follow-up and consultation

The system MUST allow the client to consult status and follow-up information for their trámites.

#### Scenario: Client checks status

- GIVEN an existing trámite
- WHEN the client opens follow-up information
- THEN the system returns the current status and next steps

### Requirement: Documents, signatures, and notifications

The system MUST allow document consultation, signature capture, and notification review from Flutter.

#### Scenario: Document and signature flow

- GIVEN a trámite that requires a document or signature
- WHEN the client opens the mobile flow
- THEN the system exposes the document view and signature action

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
