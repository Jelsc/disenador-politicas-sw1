package com.tuapp.backend.policies.application;

import com.tuapp.backend.policies.collaboration.lock.PolicyEditLock;
import com.tuapp.backend.policies.collaboration.lock.PolicyEditLockRepository;
import com.tuapp.backend.policies.domain.model.Policy;
import com.tuapp.backend.policies.domain.repository.PolicyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PolicyEditLockServiceTest {

    private MutableClock clock;
    private InMemoryPolicyEditLockRepository repository;
    private PolicyEditLockService service;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        repository = new InMemoryPolicyEditLockRepository(clock);
        PolicyRepository policyRepository = mock(PolicyRepository.class);
        when(policyRepository.findById("policy-1")).thenReturn(Optional.of(Policy.builder().id("policy-1").name("Policy").build()));
        service = new PolicyEditLockService(policyRepository, repository, Duration.ofMinutes(5), clock);
    }

    @Test
    void acquiresAndReleasesPolicyLock() {
        PolicyEditLock lock = service.acquire("policy-1", "alice");

        assertThat(lock.username()).isEqualTo("alice");
        assertThat(service.status("policy-1")).contains(lock);

        service.release("policy-1", "alice");

        assertThat(service.status("policy-1")).isEmpty();
    }

    @Test
    void rejectsSecondEditorWhileLockIsActive() {
        service.acquire("policy-1", "alice");

        assertThatThrownBy(() -> service.acquire("policy-1", "bob"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode")
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void allowsReacquireAfterExpiry() {
        service.acquire("policy-1", "alice");
        clock.advance(Duration.ofMinutes(6));

        assertThat(service.status("policy-1")).isEmpty();

        PolicyEditLock lock = service.acquire("policy-1", "bob");

        assertThat(lock.username()).isEqualTo("bob");
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        private void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }

    private static final class InMemoryPolicyEditLockRepository implements PolicyEditLockRepository {
        private final MutableClock clock;
        private final Map<String, PolicyEditLock> locks = new HashMap<>();

        private InMemoryPolicyEditLockRepository(MutableClock clock) {
            this.clock = clock;
        }

        @Override
        public Optional<PolicyEditLock> findActive(String policyId, Instant now) {
            PolicyEditLock lock = locks.get(policyId);
            if (lock == null) {
                return Optional.empty();
            }
            if (lock.expiresAt().isBefore(now)) {
                locks.remove(policyId);
                return Optional.empty();
            }
            return Optional.of(lock);
        }

        @Override
        public boolean acquire(PolicyEditLock lock, Duration ttl) {
            PolicyEditLock current = locks.get(lock.policyId());
            if (current != null && current.expiresAt().isAfter(clock.instant())) {
                return false;
            }
            locks.put(lock.policyId(), lock);
            return true;
        }

        @Override
        public boolean release(String policyId, String username) {
            PolicyEditLock lock = locks.get(policyId);
            if (lock == null || !lock.username().equals(username)) {
                return false;
            }
            locks.remove(policyId);
            return true;
        }
    }
}
