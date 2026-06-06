## Exploration: cycle-2-ai-docs-uml

### Current State
- **AI Service**: FastAPI running Python `qwen2.5:3b-instruct` via Ollama for flow design suggestions and validation. No voice/audio interpretation or live route prediction exposed yet.
- **Documents**: `FileStorageService` currently uses the local filesystem (`uploads/`) which prevents scaling across instances.
- **Mobile**: Flutter app (`mobile/lib/`) exists but only contains basic UI screens (`procedure_detail_screen`, `login_screen`, `home_screen`). Missing advanced text/audio intakes and analyst support views.
- **Frontend Board**: Angular `policy-form` and collaborative views exist. UI already started shifting to UML 2.5 activity-diagram visuals, but needs deeper integration with AI-suggested nodes and WebSocket real-time updates.

### Affected Areas
- `backend/src/main/java/com/tuapp/backend/shared/infrastructure/storage/FileStorageService.java` — Needs refactoring to an interface with an S3 implementation.
- `backend/src/main/java/com/tuapp/backend/config/WebSocketConfig.java` & Collaboration Handlers — Needs implementation for real-time collaboration using Redis pub/sub.
- `services/ai-service/app/main.py` — Needs new endpoints for voice-to-structured-field interpretation, anomaly detection (using historical execution logs), and route prediction.
- `mobile/lib/screens/` — Needs new UI components for text/audio request intake and voice recording permissions.
- `frontend/src/app/policies/` — Needs adaptation to UML 2.5 standards for AI-generated sub-flows and collaboration sync.

### Approaches
1. **S3 Storage Implementation**
   - *Description*: Extract `FileStorageService` to an interface, add `S3FileStorageService` using AWS SDK for Java.
   - *Pros*: Highly scalable, standard pattern for distributed backends.
   - *Cons*: Adds external dependency and requires network I/O.
   - *Effort*: Low

2. **AI Voice/Audio Intake**
   - *Description*: Extend FastAPI to accept audio files, transcribe using a lightweight local STT model (e.g., Whisper) or external API, and parse intent to JSON for field filling.
   - *Pros*: Leverages existing AI Python stack and integrates with Ollama context.
   - *Cons*: Voice processing can be heavy if running locally alongside Qwen.
   - *Effort*: High

3. **WebSocket Collaboration**
   - *Description*: Implement Redis Pub/Sub in Spring Boot and broadcast UI board events (UML 2.5 node changes) to Angular clients.
   - *Pros*: Seamless UX for policy designers.
   - *Cons*: Requires conflict resolution/locking logic on the board.
   - *Effort*: Medium

### Recommendation
Adopt S3 for storage immediately to unblock distributed scaling and document attachments. For AI Voice intake, use FastAPI to orchestrate transcriptions (offloading to a lighter STT or API if hardware is constrained) and pass text to the existing Ollama setup for field structuring. For WebSocket collaboration, start with a simple lock-based mechanism (one editor per node) using Redis to prevent complex merge conflicts on the UML board.

### Risks
- Local AI resources (Qwen + STT) might exceed the Docker Compose environment memory limits.
- Flutter audio recording plugins require robust permission handling across iOS/Android.
- WebSocket state sync can cause race conditions if the board allows concurrent edits on the same UML node.

### Ready for Proposal
Yes — The context is clear and the S3 + AI integrations fit cleanly into the existing modular architecture.