package com.tuapp.backend.users.infrastructure;

import com.tuapp.backend.users.domain.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * MongoDB User Repository: persistence layer for User entities
 */
@Repository
public interface MongoUserRepository extends MongoRepository<User, String> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Iterable<User> findByDepartmentIdsContaining(String departmentId);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
}
