# Delta for AI Routing

## MODIFIED Requirements

### Requirement: Route and risk prediction

The system MUST derive route, delay risk, and priority guidance from available historical and execution performance signals.

(Previously: Prediction returned route, risk, and priority values without requiring real performance signals.)

#### Scenario: Prediction succeeds with history

- GIVEN sufficient historical performance data exists
- WHEN the AI routing service processes a valid request
- THEN it returns route, risk, and priority guidance based on those signals

#### Scenario: Insufficient history

- GIVEN there is not enough historical data for a confident prediction
- WHEN the AI routing service processes a request
- THEN it returns a low-confidence or unavailable result
- AND it MUST NOT invent a performance signal
