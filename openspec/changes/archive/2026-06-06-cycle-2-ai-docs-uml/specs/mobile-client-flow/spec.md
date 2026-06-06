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
