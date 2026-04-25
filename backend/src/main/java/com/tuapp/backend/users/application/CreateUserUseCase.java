package com.tuapp.backend.users.application;

import com.tuapp.backend.shared.application.UseCase;
import com.tuapp.backend.users.domain.DepartmentRepository;
import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * CreateUserUseCase: creates a new user in the system.
 * Handles password encryption and duplicate user checking.
 */
@Service
public class CreateUserUseCase implements UseCase<CreateUserRequest, UserResponse> {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;

    public CreateUserUseCase(UserRepository userRepository,
                             DepartmentRepository departmentRepository,
                             PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
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

        Role selectedRole;
        try {
            selectedRole = Role.valueOf(request.getRole());
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid role");
        }

        List<String> departmentIds = normalizeDepartmentIds(selectedRole, request.getDepartmentIds());

        // Create user
        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoles(Collections.singletonList(selectedRole));
        user.setDepartmentIds(departmentIds);
        user.setActive(true);

        // Save user
        User savedUser = userRepository.save(user);

        // Return response (without password)
        return new UserResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                (savedUser.getRoles() != null && !savedUser.getRoles().isEmpty()) ? savedUser.getRoles().get(0).name() : null,
                savedUser.getDepartmentIds() != null ? savedUser.getDepartmentIds() : Collections.emptyList(),
                savedUser.isActive()
        );
    }

    private List<String> normalizeDepartmentIds(Role selectedRole, List<String> departmentIds) {
        List<String> normalizedDepartmentIds = new ArrayList<>();

        if (departmentIds != null) {
            departmentIds.stream()
                    .filter(departmentId -> departmentId != null && !departmentId.trim().isEmpty())
                    .map(String::trim)
                    .distinct()
                    .forEach(normalizedDepartmentIds::add);
        }

        if (selectedRole == Role.OPERATOR) {
            if (normalizedDepartmentIds.isEmpty()) {
                throw new IllegalArgumentException("At least one department is required for OPERATOR users");
            }

            for (String departmentId : normalizedDepartmentIds) {
                if (departmentRepository.findById(departmentId).isEmpty()) {
                    throw new IllegalArgumentException("Department not found");
                }
            }

            return normalizedDepartmentIds;
        }

        return Collections.emptyList();
    }
}
