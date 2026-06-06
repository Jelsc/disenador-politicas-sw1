# Proposal: Cycle 2 AI, Documents, and UML Enhancements

## Intent

Cycle 2 evolves Cycle 1 into a collaborative workflow platform with per-trámite document repositories, a Flutter citizen flow, and a central TensorFlow-driven AI layer for intake, routing, forms, and reporting.

## Scope

### In Scope
- Create a document repository per trámite with upload, view, versioning, traceability, and policy-based permissions.
- Preserve the existing Cycle 1 collaboration for policy creation and task/form creation.
- Add collaborative document observation and controlled document updates for multiple funcionarios.
- Expand the Flutter client to cover request initiation, follow-up, forms, documents, signatures, and notifications.
- Move AI toward a central TensorFlow/deep-learning core for audio/text intake, structured interpretation, routing, risk, priority, anomaly detection, and report generation.
- Keep S3 as the document storage backend.

### Out of Scope
- Migrating document storage to DynamoDB.
- Replacing the existing Cycle 1 policy/task/form collaboration model.
- Real-time multi-cursor document editing.
- Removing fallback AI paths before the TensorFlow replacement reaches parity.

## Capabilities

### New Capabilities
- `document-repository`: Trámite-scoped document storage, versioning, traceability, and permissions.
- `document-collaboration`: Multi-user observation and controlled collaboration over documents.
- `mobile-client-flow`: Flutter citizen flow for requests, follow-up, forms, documents, signatures, and notifications.
- `ai-core`: TensorFlow-forward structured intelligence for intake and decision support.
- `ai-routing`: Route, delay-risk, and priority prediction.
- `ai-reports`: Voice/text driven report generation.

### Modified Capabilities
- None

## Approach

- **Documents**: Spring Boot owns document metadata, versioning, and S3-backed persistence per trámite.
- **Collaboration**: Cycle 1 keeps policy/task/form collaboration; Cycle 2 adds collaborative document observation and controlled updates.
- **AI**: FastAPI exposes structured intake, routing, form interpretation, anomaly detection, and report generation backed by TensorFlow services.
- **Client**: Flutter becomes the primary citizen entry point for request initiation, document interaction, and signatures.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/shared/infrastructure/storage` | Modified | S3-backed document repository and versioned persistence |
| `backend/policies` | Modified | Keep existing policy/task/form collaboration; add document-permission enforcement |
| `services/ai-service/app/main.py` | Modified | Add central AI contracts for intake, routing, reports, and structured interpretation |
| `mobile/lib/` | New | Full client request/follow-up/document/signature flow |
| `frontend/src/app/policies` | Modified | Integrate document-aware designer tools and AI support |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| AI model complexity and hardware strain | High | Use staged TensorFlow rollout with deterministic validation and fallbacks. |
| Document version drift or permission mismatch | Med | Enforce repository-scoped rules and traceability checks. |

## Rollback Plan

- **Storage**: Keep the development fallback path while S3 is validated.
- **AI**: Keep fallback AI paths until TensorFlow parity is achieved.
- **Client**: Revert mobile AI entry points to manual flows if required.

## Dependencies

- Local/Cloud S3 compatible storage (e.g., MinIO or AWS S3).
- TensorFlow-capable Python environment for the AI core.
- Mobile client access to microphone, camera, and file picker.

## Success Criteria

- [ ] Documents successfully upload and download from S3.
- [ ] Document repositories keep version history and traceability per trámite.
- [ ] Policy/task/form collaboration remains intact from Cycle 1.
- [ ] Flutter covers request initiation, follow-up, forms, documents, signatures, and notifications.
- [ ] AI returns structured intake, routing, anomaly, and report results from voice/text input.
