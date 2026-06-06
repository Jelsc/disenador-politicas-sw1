# Design: Cycle 2 AI, Documents, and UML Enhancements

## Technical Approach

Keep the current Spring Boot, FastAPI, Angular, and Flutter split, but reframe Cycle 2 around three explicit domains: per-trámite document repositories, a central TensorFlow-forward AI core, and a full Flutter citizen flow. Existing Cycle 1 collaboration for policy creation and task/form creation stays as-is; Cycle 2 adds document collaboration, repository rules, versioning, and traceability.

## Architecture Decisions

### Decision: Abstract document storage behind a service boundary

**Choice**: Model document handling as a trámite-scoped repository with S3-backed persistence, versioned metadata, and traceability events.
**Alternatives considered**: Single shared document bucket; filesystem-only storage.
**Rationale**: Each trámite needs its own document history, permission rules, and audit trail. S3 satisfies distributed storage while metadata keeps the history queryable.

### Decision: Keep policy collaboration separate from document collaboration

**Choice**: Preserve Cycle 1 policy/task/form collaboration and add document collaboration as a distinct repository concern.
**Alternatives considered**: Merge all collaboration into one mechanism.
**Rationale**: Policy design and document handling have different consistency, permission, and traceability rules.

### Decision: Keep FastAPI as the AI orchestration facade

**Choice**: Extend `services/ai-service/app/main.py` with structured intake, routing, form interpretation, anomaly detection, and report drafting backed by TensorFlow services.
**Alternatives considered**: Put AI logic in Spring Boot or call models directly from Angular/mobile.
**Rationale**: The Python service already owns simulation and assistant logic, so extending it avoids duplicating model handling and keeps the AI boundary clean.

### Decision: Make Flutter the full citizen entry point

**Choice**: Route client request initiation, follow-up, documents, signatures, and notifications through Flutter.
**Alternatives considered**: Keep those flows web-only.
**Rationale**: The cycle scope explicitly includes the client app and the citizen should interact from mobile first.

## Data Flow

`Mobile/Angular input → FastAPI AI facade → structured response`

`Frontend policy edit → Redis lock check → board sync / release`

`Upload/download request → Spring controller → trámite repository metadata + S3 object storage`

`Flutter client flow → request intake / docs / signatures / follow-up`

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/main/java/com/tuapp/backend/shared/infrastructure/storage/FileStorageService.java` | Modify | Support repository-scoped S3 persistence and metadata-driven retrieval. |
| `backend/src/main/java/com/tuapp/backend/shared/infrastructure/storage/FileStorageController.java` | Modify | Keep upload/download contract stable while adding versioned document behavior. |
| `backend/src/main/java/com/tuapp/backend/policies/.../PolicyEditLockService.java` | Keep | Preserve Cycle 1 policy edit collaboration behavior. |
| `services/ai-service/app/main.py` | Modify | Add structured AI contracts for intake, routing, forms, and reports. |
| `frontend/src/app/policies/components/policy-form/policy-form.component.ts` | Modify | Integrate document-aware designer tools and AI support. |
| `mobile/lib/services/api_service.dart` | Modify | Add full client-flow API calls. |
| `mobile/lib/screens/ai_request_screen.dart` | Create | Capture text/audio requests for AI intake and report creation. |

## Interfaces / Contracts

```java
interface DocumentStorage {
  String store(MultipartFile file, List<String> allowedFormats, Long maxFileSizeMb);
  Resource load(String fileName);
}
```

AI responses stay JSON-shaped so Angular and Flutter can consume them without adapter logic.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Repository metadata, document permissions, AI request shaping | Fast tests for service boundaries and validation. |
| Integration | S3 upload/download, repository versioning, FastAPI endpoints, Flutter client requests | Container-backed or service-backed integration tests. |
| E2E | Upload document, view version history, submit mobile request, generate report | Existing frontend/mobile flows with real HTTP endpoints. |

## Migration / Rollout

No destructive migration required. Roll out behind configuration so S3-backed repositories and TensorFlow AI can coexist with fallback paths until parity is proven.

## Open Questions

None blocking. The TensorFlow model family can be finalized during implementation without changing the contract.
