# Delta for AI Reports

## MODIFIED Requirements

### Requirement: Dynamic report generation

The system MUST expose a report generator UI that accepts text or voice input and returns a reviewable report draft.

(Previously: Report creation was described as draft generation from text or voice requests.)

#### Scenario: Text report request

- GIVEN a valid text report request
- WHEN the user submits it in the generator UI
- THEN it returns a report draft

#### Scenario: Voice report request

- GIVEN a valid audio report request
- WHEN the user submits it in the generator UI
- THEN it returns a report draft derived from the request
