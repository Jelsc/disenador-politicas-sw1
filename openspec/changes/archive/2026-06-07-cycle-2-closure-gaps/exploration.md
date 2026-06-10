## Exploration: Cycle 2 closure gaps

### Current State
- Backend already covers trámite-scoped document repository settings, versioning, read/write permission checks, download, and S3-backed file storage.
- Web UI is the largest gap: there is no Angular route/component for document repository configuration, browsing, viewing, or collaboration; the policy designer mainly covers policy versioning, simulation, and AI assistance.
- Mobile is the most complete end-user surface today: home → procedure detail → documents/signature/notifications → AI request screen. But the AI UX is still utility-style, with manual text/base64 input and no live voice capture or guided continuation flow.
- AI service already exposes `/simulate`, `/voice/intake`, `/analyst/insights`, `/reports/draft`, and `/form/assist`; however, policy comparison is still structural (node/connectors counts) rather than a real performance predictor.
- The archived Cycle 2 verify report passed with warnings, and the closure checklist still has multiple unchecked evidence items, so Cycle 2 is not truly closed yet.

### Affected Areas
- `frontend/src/app/app.routes.ts` — no document repository routes exist yet.
- `frontend/src/app/policies/components/policy-form/*` — policy simulation, versioning, assistant, voice prompt UX, and icon/text cleanup live here.
- `frontend/src/app/policies/services/policy-ai.service.ts` — AI simulation/voice/report/form contracts.
- `backend/src/main/java/com/tuapp/backend/documents/**` — repository settings, versioning, permissions, download endpoints.
- `backend/src/main/java/com/tuapp/backend/shared/infrastructure/storage/*` — storage + content-type handling.
- `services/ai-service/app/main.py` and `app/tensorflow_core.py` — AI endpoints and model-backed prediction.
- `mobile/lib/screens/home_screen.dart`, `procedure_detail_screen.dart`, `ai_request_screen.dart`, `services/api_service.dart` — mobile documents, signatures, and AI flows.
- `docs/cycle-2-closure-checklist.md` and `openspec/changes/archive/2026-06-06-cycle-2-ai-docs-uml/*` — closure gate and prior Cycle 2 artifacts.

### Approaches
1. **Dependency-first chained delivery** — clean the shared UI first, then land web document surfaces, then analytics/report UX, then mobile IA flows.
   - Pros: reviewable slices, less rework, matches the ready backend pieces.
   - Cons: mobile users wait longer for the final IA polish.
   - Effort: Medium

2. **Channel-first delivery** — finish mobile IA as one product slice, then fill the web document gaps.
   - Pros: fastest visible payoff for end users.
   - Cons: too large for the 400-line review budget; voice, assignment, form assist, and reporting become one risky slice.
   - Effort: High

### Proposed Slice Order (easiest → hardest)
1. Final UI/UX cleanup: remove emoji/symbol literals, normalize icons, and tighten visual coherence.
2. CU22: policy-side document repository configuration UI.
3. CU14: web procedure document repository UI.
4. CU15: web document versioning/permissions UI.
5. CU16: web document viewing/collaboration UI.
6. CU12: real policy performance comparison/prediction.
7. CU19: real report-generator UI by text/voice.
8. CU17: automatic policy assignment continuation in mobile.
9. CU18: voice-driven smart form completion UX in mobile.
10. CU5: designer IA assistant end-to-end validation/UX.

### Recommendation
Use the dependency-first chain. Start with the global UI cleanup so later diffs stay reviewable, then land the document repository surfaces (config, list/upload, versioning, viewing, permissions/collaboration). After that, split the AI work into analytics/prediction and report UX, and finish with the mobile IA continuation and voice/form experience. CU5 should be last because it depends on the stabilized UX and AI contract family.

### Risks
- `CU12` is still only a structural simulation today; real prediction needs actual performance signals, not just count-based comparison.
- The web document gap is product-level, not just cosmetic: without Angular surfaces, the backend repo feels incomplete.
- Mobile AI remains fragmented until voice capture, auto-assignment continuation, and form assist share one cohesive flow.

### Ready for Proposal
Yes — tell the user to proceed with a force-chained proposal, starting with cleanup + document surfaces and keeping the mobile IA work for the last slices.
