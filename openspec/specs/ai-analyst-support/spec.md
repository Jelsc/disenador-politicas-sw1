# AI Analyst Support Specification

## Purpose

The system MUST provide analytical support for policy operations by predicting routing, risk, priority, and anomalous behavior from available history.

## Requirements

### Requirement: Predict route, risk, and priority

The system MUST return route, risk, and priority guidance for a policy-related request.

#### Scenario: Prediction is available

- GIVEN sufficient historical data exists
- WHEN the system analyzes a request
- THEN the system MUST return route, risk, and priority guidance
- AND MUST indicate the result is based on analysis rather than manual entry

#### Scenario: Insufficient history

- GIVEN there is not enough historical data for a confident prediction
- WHEN the system analyzes a request
- THEN the system MUST return a low-confidence or unavailable result
- AND MUST NOT invent missing guidance

### Requirement: Detect anomalies

The system MUST identify requests or execution patterns that deviate materially from historical behavior.

#### Scenario: Outlier is detected

- GIVEN a request differs significantly from historical patterns
- WHEN the system evaluates the request
- THEN the system MUST flag the anomaly
- AND SHOULD provide a brief reason for the flag
