package com.tuapp.backend.users.domain;

import java.util.Optional;

/**
 * Repository interface for User persistence.
 * Defines contracts for user data access operations.
 */
public interface UserRepository {
    User save(User user);
    Optional<User> findById(String id);
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Iterable<User> findAll();
    Iterable<User> findByDepartmentIdsContaining(String departmentId);
    void deleteById(String id);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
}
