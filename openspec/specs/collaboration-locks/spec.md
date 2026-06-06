# Collaboration Locks Specification

## Purpose

The system MUST prevent simultaneous conflicting edits to the same policy by enforcing an exclusive edit lock.

## Requirements

### Requirement: Exclusive policy edit lock

The system MUST allow only one active editor per policy at a time.

#### Scenario: Lock is granted to the first editor

- GIVEN no active lock exists for a policy
- WHEN a user opens the policy for editing
- THEN the system MUST grant the user an edit lock
- AND MUST prevent other users from acquiring the same lock until it is released or expires

#### Scenario: Lock contention is rejected

- GIVEN another user already holds the edit lock
- WHEN a second user tries to edit the same policy
- THEN the system MUST reject the second edit session
- AND MUST expose that the policy is currently locked

### Requirement: Lock release and expiry

The system MUST release an edit lock when the editor saves, cancels, or the lock expires.

#### Scenario: Lock expires after inactivity

- GIVEN a user holds an edit lock and becomes inactive
- WHEN the lock lifetime expires
- THEN the system MUST release the lock automatically
- AND another user MAY acquire the lock afterward
