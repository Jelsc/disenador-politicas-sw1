# Document Collaboration Specification

## Purpose

Support collaborative observation and controlled updates over trámite documents without redefining policy-design collaboration.

## Requirements

### Requirement: Multi-user document observation

The system MUST allow multiple authorized users to observe the same document concurrently.

#### Scenario: Multiple observers join

- GIVEN a document that is accessible to two authorized users
- WHEN both users open the document
- THEN the system allows both observers

### Requirement: Controlled collaborative updates

The system MUST record which user changes a document and MUST prevent unauthorized updates.

#### Scenario: Authorized update is recorded

- GIVEN an authorized user and an editable document
- WHEN the user adds a tracked change
- THEN the system records the user and the change

#### Scenario: Unauthorized update is rejected

- GIVEN a user without document write permission
- WHEN the user attempts to modify the document
- THEN the system rejects the update

### Requirement: Policy-defined permissions

The system MUST apply document repository permissions defined by the associated policy.

#### Scenario: Policy restricts access

- GIVEN a policy that restricts document write access
- WHEN a non-authorized user opens the repository
- THEN the system limits the available actions to read-only or denies access

### Requirement: Collaboration presence and permission feedback

The system MUST show authorized users who can observe or edit a document and MUST surface read-only or locked state when permissions prevent editing.

#### Scenario: View-only access is visible

- GIVEN a user with read-only access
- WHEN the user opens the document in the web UI
- THEN the system shows collaboration state and restricts editing actions

#### Scenario: Existing editor is visible

- GIVEN another authorized user is editing the same document
- WHEN a second authorized user opens it
- THEN the system shows the current presence or edit state
- AND does not allow a conflicting edit session
