package com.tuapp.backend.policies.application;

import com.tuapp.backend.policies.collaboration.lock.PolicyEditLock;
import com.tuapp.backend.policies.collaboration.lock.PolicyEditLockRepository;
import com.tuapp.backend.policies.domain.repository.PolicyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
public class PolicyEditLockService {

    private final PolicyRepository policyRepository;
    private final PolicyEditLockRepository lockRepository;
    private final Duration lockTtl;
    private final Clock clock;

    public PolicyEditLockService(PolicyRepository policyRepository,
                                 PolicyEditLockRepository lockRepository,
                                 @Value("${app.policy-lock.ttl:PT5M}") Duration lockTtl,
                                 Clock clock) {
        this.policyRepository = policyRepository;
        this.lockRepository = lockRepository;
        this.lockTtl = lockTtl;
        this.clock = clock;
    }

    public PolicyEditLock acquire(String policyId, String username) {
        ensurePolicyExists(policyId);
        Instant now = clock.instant();
        Optional<PolicyEditLock> current = lockRepository.findActive(policyId, now);
        if (current.isPresent() && !current.get().username().equals(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Policy is already locked by another editor");
        }

        PolicyEditLock lock = new PolicyEditLock(policyId, username, now, now.plus(lockTtl));
        if (current.isPresent() && current.get().username().equals(username)) {
            lockRepository.release(policyId, username);
        }
        if (!lockRepository.acquire(lock, lockTtl)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Policy is already locked by another editor");
        }
        return lock;
    }

    public Optional<PolicyEditLock> status(String policyId) {
        ensurePolicyExists(policyId);
        return lockRepository.findActive(policyId, clock.instant());
    }

    public void release(String policyId, String username) {
        ensurePolicyExists(policyId);
        if (!lockRepository.release(policyId, username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only the current editor can release this lock");
        }
    }

    private void ensurePolicyExists(String policyId) {
        if (policyRepository.findById(policyId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Policy not found");
        }
    }
}
