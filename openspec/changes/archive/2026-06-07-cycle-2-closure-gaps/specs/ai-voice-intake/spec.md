# Delta for AI Voice Intake

## ADDED Requirements

### Requirement: Guided voice capture

The system MUST guide the user through voice intake and preserve the original submission while capture is in progress.

#### Scenario: Capture prompt is shown

- GIVEN the client starts voice intake
- WHEN the capture flow opens
- THEN the system prompts for recording and preserves the draft submission

#### Scenario: Capture is resumed

- GIVEN voice capture was interrupted
- WHEN the client resumes intake
- THEN the system restores the original submission and partial transcript

### Requirement: Preserve incomplete intake state

The system MUST persist partial voice or text intake until submission is completed or discarded.

#### Scenario: Draft survives navigation

- GIVEN the user has partially completed intake
- WHEN the user navigates away and returns
- THEN the system restores the partial state
