package com.tuapp.backend.users.infrastructure;

import com.tuapp.backend.users.domain.Department;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * MongoDB Department Repository: persistence layer for Department entities
 */
@Repository
public interface MongoDepartmentRepository extends MongoRepository<Department, String> {
    Optional<Department> findByName(String name);
    boolean existsByName(String name);
}
