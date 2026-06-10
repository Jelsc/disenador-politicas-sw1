# Tasks: Cycle 2 Closure Gaps

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 560-760 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shared UI/icon cleanup and nav prep | PR 1 | base = feature/tracker branch; swap literal glyph buttons and add repo entry points |
| 2 | Web document repository + collaboration shell | PR 2 | base = PR 1 branch; create repo service/component and document websocket wiring |
| 3 | AI routing/report closure | PR 3 | base = PR 2 branch; real prediction/report contracts and UI wiring |
| 4 | Mobile continuation and voice intake | PR 4 | base = PR 3 branch; draft restore, resume card, and voice-assisted flow |

## Phase 1: Shared Cleanup

- [x] 1.1 Replace literal emoji/glyph buttons in `frontend/src/app/policies/components/policy-form/policy-form.component.html|ts|policy-form.global.css` and `frontend/src/app/execution/components/procedure-simulator/procedure-simulator.component.ts` with `ng-icons`.
- [x] 1.2 Add document repository launch affordances in `frontend/src/app/shared/components/dashboard/dashboard.component.ts` and `frontend/src/app/app.routes.ts`.

## Phase 2: Web Repository

 - [x] 2.1 Create `frontend/src/app/policies/services/document-repository.service.ts` plus `frontend/src/app/policies/components/document-repository/document-repository.component.{ts,html,css}` for settings, browsing, versions, and permissions.
 - [x] 2.2 Wire `/policies/:id/documents` and `/tramites/:id/documents` routes, plus the policy-form repository button and view-only entry state.
- [x] 2.3 Add `backend/src/main/java/com/tuapp/backend/documents/collaboration/DocumentCollaborationWebSocketHandler.java` and register it in `backend/src/main/java/com/tuapp/backend/config/WebSocketConfig.java`.

## Phase 3: AI Closure

- [x] 3.1 Extend `frontend/src/app/policies/services/policy-ai.service.ts` and `policy-ai.service.spec.ts` for history-based insights and draft-report payloads.
- [x] 3.2 Update `frontend/src/app/policies/components/policy-form/policy-form.component.ts|html` to show real route/risk/priority comparison and report mode.

## Phase 4: Mobile Closure

- [x] 4.1 Add `mobile/lib/models/ai_request_draft.dart` and persist partial intake in `mobile/lib/screens/ai_request_screen.dart`.
- [x] 4.2 Update `mobile/lib/services/api_service.dart`, `mobile/lib/screens/home_screen.dart`, and `mobile/pubspec.yaml` for draft-aware calls, voice capture, and resume card.
- [x] 4.3 Verify `mobile/lib/screens/procedure_detail_screen.dart` and `ai_request_screen.dart` restore unfinished voice/text state after navigation.

## Phase 5: Testing / Cleanup

- [x] 5.1 Add Jasmine and Flutter tests for repo browsing, prediction fallback, draft restore, and voice-assisted field fill scenarios.
- [x] 5.2 Run `cd frontend && npm test`; remove any leftover glyph-only UI fragments after the chained slices land.
