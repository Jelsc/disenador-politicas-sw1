package com.tuapp.backend.policies.collaboration.lock;

import java.time.Instant;

public record PolicyEditLock(String policyId, String username, Instant acquiredAt, Instant expiresAt) {
}
