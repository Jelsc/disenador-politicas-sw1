package com.tuapp.backend.users.application;

import com.tuapp.backend.shared.application.UseCase;
import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * CreateUserUseCase: creates a new user in the system.
 * Handles password encryption and duplicate user checking.
 */
@Service
public class CreateUserUseCase implements UseCase<CreateUserRequest, UserResponse> {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public CreateUserUseCase(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public UserResponse execute(CreateUserRequest request) {
        // Validate input
        if (request.getUsername() == null || request.getUsername().isEmpty()) {
            throw new IllegalArgumentException("Username is required");
        }
        if (request.getEmail() == null || request.getEmail().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }

        // Check for duplicates
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Create user
        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoles(Collections.singletonList(Role.valueOf(request.getRole())));
        user.setDepartmentId(request.getDepartmentId());
        user.setActive(true);

        // Save user
        User savedUser = userRepository.save(user);

        // Return response (without password)
        return new UserResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                savedUser.getRoles().get(0).name(),
                savedUser.getDepartmentId(),
                savedUser.isActive()
        );
    }
}
