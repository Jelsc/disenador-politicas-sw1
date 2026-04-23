package com.tuapp.backend.users.infrastructure;

import com.tuapp.backend.users.domain.Department;
import com.tuapp.backend.users.domain.DepartmentRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * DepartmentRepositoryAdapter: implements DepartmentRepository domain interface using MongoDB
 */
@Service
public class DepartmentRepositoryAdapter implements DepartmentRepository {

    private final MongoDepartmentRepository mongoDepartmentRepository;

    public DepartmentRepositoryAdapter(MongoDepartmentRepository mongoDepartmentRepository) {
        this.mongoDepartmentRepository = mongoDepartmentRepository;
    }

    @Override
    public Department save(Department department) {
        return mongoDepartmentRepository.save(department);
    }

    @Override
    public Optional<Department> findById(String id) {
        return mongoDepartmentRepository.findById(id);
    }

    @Override
    public Optional<Department> findByName(String name) {
        return mongoDepartmentRepository.findByName(name);
    }

    @Override
    public Iterable<Department> findAll() {
        return mongoDepartmentRepository.findAll();
    }

    @Override
    public void deleteById(String id) {
        mongoDepartmentRepository.deleteById(id);
    }

    @Override
    public boolean existsByName(String name) {
        return mongoDepartmentRepository.existsByName(name);
    }
}
