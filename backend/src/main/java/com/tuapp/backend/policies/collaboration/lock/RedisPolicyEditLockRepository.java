package com.tuapp.backend.policies.collaboration.lock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Repository
public class RedisPolicyEditLockRepository implements PolicyEditLockRepository {

    private final StringRedisTemplate redisTemplate;
    private final String lockPrefix;

    public RedisPolicyEditLockRepository(StringRedisTemplate redisTemplate,
                                         @Value("${app.policy-lock.prefix:policy-lock}") String lockPrefix) {
        this.redisTemplate = redisTemplate;
        this.lockPrefix = lockPrefix;
    }

    @Override
    public Optional<PolicyEditLock> findActive(String policyId, Instant now) {
        String raw = redisTemplate.opsForValue().get(key(policyId));
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        PolicyEditLock lock = parse(policyId, raw);
        if (lock.expiresAt().isBefore(now)) {
            redisTemplate.delete(key(policyId));
            return Optional.empty();
        }
        return Optional.of(lock);
    }

    @Override
    public boolean acquire(PolicyEditLock lock, Duration ttl) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(key(lock.policyId()), serialize(lock), ttl));
    }

    @Override
    public boolean release(String policyId, String username) {
        Optional<PolicyEditLock> current = findActive(policyId, Instant.now());
        if (current.isEmpty() || !current.get().username().equals(username)) {
            return false;
        }
        return Boolean.TRUE.equals(redisTemplate.delete(key(policyId)));
    }

    private String serialize(PolicyEditLock lock) {
        return String.join("|", lock.username(), String.valueOf(lock.acquiredAt().toEpochMilli()), String.valueOf(lock.expiresAt().toEpochMilli()));
    }

    private PolicyEditLock parse(String policyId, String raw) {
        String[] parts = raw.split("\\|");
        Instant acquiredAt = parts.length > 1 ? Instant.ofEpochMilli(Long.parseLong(parts[1])) : Instant.now();
        Instant expiresAt = parts.length > 2 ? Instant.ofEpochMilli(Long.parseLong(parts[2])) : Instant.now();
        return new PolicyEditLock(policyId, parts.length > 0 ? parts[0] : "unknown", acquiredAt, expiresAt);
    }

    private String key(String policyId) {
        return lockPrefix + ":" + policyId;
    }
}
