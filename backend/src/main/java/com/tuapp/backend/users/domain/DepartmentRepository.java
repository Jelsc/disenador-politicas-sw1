package com.tuapp.backend.users.domain;

import java.util.Optional;

/**
 * Repository interface for Department persistence.
 * Defines contracts for department data access operations.
 */
public interface DepartmentRepository {
    Department save(Department department);
    Optional<Department> findById(String id);
    Optional<Department> findByName(String name);
    Iterable<Department> findAll();
    void deleteById(String id);
    boolean existsByName(String name);
}
