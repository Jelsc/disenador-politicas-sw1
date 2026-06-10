# Proposal: Cycle 2 Closure Gaps

## Intent

Close the remaining Cycle 2 gaps so the backend capabilities are visible and usable in the web and mobile products. The largest user-facing gap is the missing web document surface; AI/mobile closure work follows after the shared UI cleanup.

## Scope

### In Scope
- Normalize shared UI/UX and iconography so later diffs stay reviewable.
- Add web document repository/configuration, versioning, permissions, and viewing/collaboration entry points.
- Finish the remaining AI/mobile closure slices for prediction, reports, voice intake, and continuation flows.

### Out of Scope
- New backend domains or storage models.
- Replacing existing AI fallback behavior.
- Broad redesign beyond the closure slices.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `document-repository`: expose repository config, browsing, version history, and web viewing UI.
- `document-collaboration`: surface controlled multi-user viewing/editing and permission feedback.
- `mobile-client-flow`: continue assignment, voice intake, and smart form completion UX.
- `ai-routing`: replace structural comparison with real prediction signals.
- `ai-reports`: add text/voice report generator UX.
- `ai-voice-intake`: support guided voice capture and preserved submission state.

## Approach

Use dependency-first delivery in a feature-branch chain. Ship the UI/icon cleanup first, then the web document surfaces, then AI analytics/reporting, and finish with mobile continuation/voice UX. Keep each slice independently reviewable and under the 400-line budget.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/app.routes.ts` | Modified | Add document repository routes and navigation.
| `frontend/src/app/policies/**` | Modified | Cleanup plus policy/document/AI UX updates.
| `frontend/src/app/policies/services/policy-ai.service.ts` | Modified | Align UI contracts with prediction/report/voice flows.
| `mobile/lib/screens/**` | Modified | Continue the mobile assignment and voice/form flow.
| `backend/src/main/java/com/tuapp/backend/documents/**` | Unchanged | Existing repository APIs remain the source contract.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Slice grows beyond review budget | High | Chain by capability and keep each PR autonomous.
| UI diverges from backend contracts | Medium | Reuse existing repository/AI contracts and keep fallback paths.
| Real prediction is hard to validate | Medium | Preserve deterministic fallback until parity is proven.

## Rollback Plan

Revert the last chained slice only. Keep the UI cleanup and backend contracts intact, and restore the prior route/component wiring if a later slice regresses.

## Dependencies

- Existing document repository, collaboration, and AI endpoints must stay stable.

## Success Criteria

- [ ] Web document repository flows are reachable from the UI.
- [ ] Mobile AI continuation and voice/form closure flows are complete.
- [ ] Each chained slice stays independently reviewable and below the budget.
