package com.tuapp.backend.users.infrastructure;

import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * UserRepositoryAdapter: implements UserRepository domain interface using MongoDB
 */
@Service
public class UserRepositoryAdapter implements UserRepository {

    private final MongoUserRepository mongoUserRepository;

    public UserRepositoryAdapter(MongoUserRepository mongoUserRepository) {
        this.mongoUserRepository = mongoUserRepository;
    }

    @Override
    public User save(User user) {
        return mongoUserRepository.save(user);
    }

    @Override
    public Optional<User> findById(String id) {
        return mongoUserRepository.findById(id);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return mongoUserRepository.findByUsername(username);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return mongoUserRepository.findByEmail(email);
    }

    @Override
    public Iterable<User> findAll() {
        return mongoUserRepository.findAll();
    }

    @Override
    public Iterable<User> findByDepartmentId(String departmentId) {
        return mongoUserRepository.findByDepartmentId(departmentId);
    }

    @Override
    public void deleteById(String id) {
        mongoUserRepository.deleteById(id);
    }

    @Override
    public boolean existsByUsername(String username) {
        return mongoUserRepository.existsByUsername(username);
    }

    @Override
    public boolean existsByEmail(String email) {
        return mongoUserRepository.existsByEmail(email);
    }
}
