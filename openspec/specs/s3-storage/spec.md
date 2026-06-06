# S3 Storage Specification

## Purpose

The system MUST persist procedure documents in S3-compatible storage so documents remain available outside the local filesystem and can be retrieved consistently across instances.

## Requirements

### Requirement: S3-backed document persistence

The system MUST store uploaded procedure documents in S3-compatible storage and return a stable document reference for later retrieval.

#### Scenario: Upload and retrieve a document

- GIVEN a user uploads a valid document for a procedure
- WHEN the upload succeeds
- THEN the system stores the file in S3-compatible storage
- AND returns a document reference that can be used to download the same content later

#### Scenario: Storage failure is reported safely

- GIVEN S3-compatible storage is unavailable
- WHEN a user uploads a document
- THEN the system MUST reject the upload with a clear failure response
- AND MUST NOT create a broken document reference
