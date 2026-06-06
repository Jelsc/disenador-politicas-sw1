# Tasks: Cycle 2 AI, Docs, and UML Enhancements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1400-2200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 document repository foundation → PR 2 TensorFlow AI core → PR 3 Flutter client + collaboration UX → PR 4 verification/docs |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Document repository foundation | PR 1 | Base on main; isolate repository, metadata, versioning, and permissions. |
| 2 | TensorFlow AI core | PR 2 | Base on PR 1; keep FastAPI contracts structured and deterministic. |
| 3 | Flutter client + collaboration UX | PR 3 | Base on PR 2; include request, follow-up, documents, signatures, and notifications. |
| 4 | Verification and docs | PR 4 | Base on PR 3; close gaps and refresh docs/spec alignment. |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 `backend/.../storage`: add a `DocumentStorage` abstraction and S3-backed implementation; keep `FileStorageController` response shape stable.
- [x] 1.2 `backend/.../policy lock service`: add Redis exclusive-lock acquire/release/expiry logic for policy edits.
- [x] 1.3 `backend/config` + env templates: add S3 bucket/region and lock TTL configuration.

## Phase 2: Document Repository / Collaboration

- [x] 2.1 `backend/.../documents`: add trámite-scoped document repository metadata, upload/version tracking, and traceability.
- [x] 2.2 `backend/.../documents`: enforce policy-based document upload/view/update permissions.
- [x] 2.3 `frontend/src/app/policies` and related views: surface document history, visibility, and collaboration states in the web UI.

## Phase 3: AI Core / TensorFlow

- [x] 3.1 `services/ai-service/app/main.py`: replace heuristic intake with TensorFlow-backed structured interpretation contracts.
- [x] 3.2 `services/ai-service/app/main.py`: add route, delay-risk, priority, and anomaly prediction endpoints driven by model output.
- [x] 3.3 `services/ai-service/app/main.py`: add dynamic report generation for audio/text prompts.
- [x] 3.4 `services/ai-service/app/main.py`: add form-assist interpretation for contextual voice-driven field filling.

## Phase 4: Flutter Client Flow

- [x] 4.1 `mobile/lib/`: support client request initiation from audio/text and policy assignment.
- [x] 4.2 `mobile/lib/`: support follow-up, document consultation, upload, and traceability views.
- [x] 4.3 `mobile/lib/`: support assisted form filling, signature capture, and notifications.
- [x] 4.4 `mobile/lib/services/api_service.dart`: align all client endpoints with the new AI/document contracts.

## Phase 5: Testing / Verification

- [x] 3.1 Add backend tests for S3 upload/download, invalid format, and storage failures.
- [x] 3.2 Add lock contention and expiry tests; verify only one editor can hold a policy lock.
- [x] 3.3 Add AI endpoint tests for voice intake, analyst support, and report drafting.
- [x] 3.4 Add frontend/mobile tests for locked-edit state and AI request flows.
- [x] 5.1 Add document repository tests for versioning, permissions, and traceability.
- [x] 5.2 Add TensorFlow AI contract tests for intake, routing, reports, and form assist.
- [x] 5.3 Add Flutter tests for full client flow: initiate, follow-up, documents, signatures, notifications.

## Phase 6: Cleanup / Documentation

- [x] 4.1 Update docs/env samples to remove filesystem-only assumptions and describe fallback behavior.
- [x] 4.2 Remove temporary shims only after the new paths are verified.
- [x] 6.1 Reconcile docs/specs after the expanded scope is fully implemented.
