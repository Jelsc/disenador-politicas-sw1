# Delta for Document Collaboration

## ADDED Requirements

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
