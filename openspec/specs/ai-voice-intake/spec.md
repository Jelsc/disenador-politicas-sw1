# AI Voice Intake Specification

## Purpose

The system MUST accept voice or text requests and convert them into structured intake fields for policy-related workflows.

## Requirements

### Requirement: Voice and text intake

The system MUST accept a request submitted as audio or text and preserve the original user intent.

#### Scenario: Audio request is processed

- GIVEN a user submits an audio request
- WHEN the system processes the submission
- THEN the system MUST transcribe the audio
- AND MUST produce structured intake fields from the transcript

#### Scenario: Text request is processed

- GIVEN a user submits a text request
- WHEN the system processes the submission
- THEN the system MUST parse the text into structured intake fields

### Requirement: Failed transcription is reported

The system MUST report transcription or parsing failures without losing the original submission.

#### Scenario: Audio cannot be transcribed

- GIVEN the audio is too poor to transcribe reliably
- WHEN the system processes the request
- THEN the system MUST return a clear failure state
- AND MUST preserve the original submission for retry or manual review

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
