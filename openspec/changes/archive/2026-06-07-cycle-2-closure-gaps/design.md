# Design: Cycle 2 Closure Gaps

## Technical Approach

Land the remaining Cycle 2 work as a dependency-first feature-branch chain: 1) shared icon/UI cleanup, 2) web document repository surfaces, 3) real AI routing/report UX, 4) mobile continuation + voice intake, and 5) final polish. The backend already exposes document repository and AI contracts; the remaining work is mostly Angular/Flutter wiring plus a small websocket presence layer for document collaboration.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Route shape | One reusable document repository page driven by route data (`/policies/:id/documents` and `/tramites/:id/documents`) | Separate one-off pages per persona | Keeps config, browsing, versions, and permissions in one shell and reduces review size. |
| AI contracts | Reuse `PolicyAiService.getAnalystInsights()` and `draftReport()` for comparison/report UX | Add a second AI adapter or hard-code comparison text | The FastAPI service already returns route/risk/priority and report drafts; reusing it avoids contract drift. |
| Mobile state | Persist partial AI intake locally in `SharedPreferences` and restore from Home | Add server-side draft storage | The closure flow needs restore-after-navigation without backend schema changes. |
| Iconography cleanup | Replace literal emoji/glyph buttons with `ng-icons` and consistent labels | Keep mixed symbols | Stabilizes diffs and makes later slices reviewable. |

## Data Flow

`Policy form / repository page → document service → Spring docs API → settings + versions + file download`

`Policy form comparison → operation learning events → ai-service /analyst/insights → route/risk/priority summary`

`Mobile AI screen → local draft store + ai-service /voice/intake|/reports/draft|/form/assist → resume card in Home`

`Repository presence UI → websocket session → document collaboration state`

## File Changes

| File | Action | Description |
|---|---|---|
| `frontend/src/app/app.routes.ts` | Modify | Add document repository routes for policy and trámite views. |
| `frontend/src/app/shared/components/dashboard/dashboard.component.ts` | Modify | Add navigation entry points for document repository access. |
| `frontend/src/app/policies/services/document-repository.service.ts` | Create | Wrap repository settings, list, version history, upload, and download calls. |
| `frontend/src/app/policies/components/document-repository/document-repository.component.ts|html|css` | Create | Standalone repository shell for config, browsing, versions, permissions, and collaboration state. |
| `frontend/src/app/policies/components/policy-form/policy-form.component.ts|html|policy-form.global.css` | Modify | Add repository entry button, real comparison state, AI report mode, and cleanup of literal glyph buttons. |
| `frontend/src/app/policies/services/policy-ai.service.ts` | Modify | Add typed helpers for routing insight and report draft responses. |
| `frontend/src/app/policies/services/policy-ai.service.spec.ts` | Modify | Cover routing/report contracts. |
| `frontend/src/app/execution/components/procedure-simulator/procedure-simulator.component.ts` | Modify | Replace remaining inline glyph buttons with icons. |
| `backend/src/main/java/com/tuapp/backend/config/WebSocketConfig.java` | Modify | Register document collaboration websocket alongside existing policy sockets. |
| `backend/src/main/java/com/tuapp/backend/policies/collaboration/DocumentCollaborationWebSocketHandler.java` | Create | Broadcast document presence/lock state by trámite. |
| `mobile/pubspec.yaml` | Modify | Add voice-capture dependency. |
| `mobile/lib/models/ai_request_draft.dart` | Create | Local draft model for partial intake restoration. |
| `mobile/lib/services/api_service.dart` | Modify | Support draft-aware voice intake, report draft, and form-assist calls. |
| `mobile/lib/screens/ai_request_screen.dart` | Modify | Guided voice capture, partial save, and resume-aware submission UI. |
| `mobile/lib/screens/home_screen.dart` | Modify | Surface a resume card for in-progress AI intake. |

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit | Repository client payloads, AI routing/report parsing, mobile draft persistence | Angular Jasmine + Flutter unit/widget tests around mocked HTTP/local storage. |
| Integration | Document settings/version endpoints and websocket presence handshake | Contract-style tests against existing Spring/FastAPI endpoints. |
| E2E | Open repo UI, compare a version with real signals, resume mobile intake | Manual or scripted browser/mobile smoke once the chain lands. |

## Migration / Rollout

No data migration required. Ship each slice behind route navigation only; the last polish slice removes any leftover literal symbols after the functional flows are stable.

## Open Questions

- None blocking.
