package com.tuapp.backend.policies.collaboration.lock;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

public interface PolicyEditLockRepository {
    Optional<PolicyEditLock> findActive(String policyId, Instant now);

    boolean acquire(PolicyEditLock lock, Duration ttl);

    boolean release(String policyId, String username);
}
