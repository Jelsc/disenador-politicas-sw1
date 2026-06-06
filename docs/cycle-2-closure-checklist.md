# Cycle 2 Closure Checklist

This is the release gate for closing Cycle 2. Do not close the cycle until every item is checked and evidence is attached.

## Required Evidence

- [ ] GitHub Actions `CI` workflow is green on the target commit.
- [ ] Backend `./mvnw.cmd test` (or `./mvnw test` in CI) passes.
- [ ] Frontend `npm ci`, `npm test`, and `npm run build` pass.
- [ ] Mobile `flutter pub get`, `flutter analyze`, and `flutter test` pass.
- [ ] AI service `python -m unittest discover -s tests` passes.
- [ ] Live AI smoke tests pass for `/voice/intake`, `/reports/draft`, and `/form/assist`.
- [ ] `openspec/changes/archive/2026-06-06-cycle-2-ai-docs-uml/verify-report.md` has been reviewed.
- [ ] Cycle 2 docs and specs match the delivered behavior.
- [ ] No unresolved Cycle 2 TODOs, warnings, or blockers remain.

## Closure Rule

If any item is unchecked, Cycle 2 stays open.
