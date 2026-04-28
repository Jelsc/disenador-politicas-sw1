package com.tuapp.backend.users.presentation;

import com.tuapp.backend.users.application.CreateUserRequest;
import com.tuapp.backend.users.application.CreateUserUseCase;
import com.tuapp.backend.users.application.UpdateUserRequest;
import com.tuapp.backend.users.application.UserResponse;
import com.tuapp.backend.users.domain.DepartmentRepository;
import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * UserController: handles user management endpoints
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final CreateUserUseCase createUserUseCase;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    public UserController(CreateUserUseCase createUserUseCase,
                          UserRepository userRepository,
                          DepartmentRepository departmentRepository) {
        this.createUserUseCase = createUserUseCase;
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
    }

    /**
     * POST /api/users: create a new user (ADMIN only)
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest request) {
        try {
            UserResponse response = createUserUseCase.execute(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("Bad Request", e.getMessage()));
        }
    }

    /**
     * GET /api/users: list all users (ADMIN only)
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> listUsers(@RequestParam(required = false) String role,
                                                        @RequestParam(required = false) String departmentId) {
        Iterable<User> users = userRepository.findAll();
        List<UserResponse> responses = new ArrayList<>();

        users.forEach(user -> {
            String userRole = (user.getRoles() == null || user.getRoles().isEmpty()) ? null : user.getRoles().get(0).name();
            boolean matchesRole = role == null || role.isBlank() || role.equalsIgnoreCase(userRole);
            boolean matchesDepartment = departmentId == null || departmentId.isBlank() ||
                    (user.getDepartmentIds() != null && user.getDepartmentIds().contains(departmentId));

            if (matchesRole && matchesDepartment) {
                responses.add(toResponse(user));
            }
        });

        return ResponseEntity.ok(responses);
    }

    /**
     * GET /api/users/:id: get user by ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getUserById(@PathVariable String id) {
        var userOptional = userRepository.findById(id);
        if (userOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Not Found", "User not found"));
        }

        return ResponseEntity.ok(toResponse(userOptional.get()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateUser(@PathVariable String id, @RequestBody UpdateUserRequest request) {
        try {
            User user = userRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
                throw new IllegalArgumentException("Username is required");
            }

            if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
                throw new IllegalArgumentException("Email is required");
            }

            userRepository.findByUsername(request.getUsername().trim())
                    .filter(existing -> !existing.getId().equals(id))
                    .ifPresent(existing -> {
                        throw new IllegalArgumentException("Username already exists");
                    });

            userRepository.findByEmail(request.getEmail().trim())
                    .filter(existing -> !existing.getId().equals(id))
                    .ifPresent(existing -> {
                        throw new IllegalArgumentException("Email already exists");
                    });

            Role selectedRole;
            try {
                selectedRole = Role.valueOf(request.getRole());
            } catch (Exception exception) {
                throw new IllegalArgumentException("Invalid role");
            }

            user.setUsername(request.getUsername().trim());
            user.setEmail(request.getEmail().trim());
            user.setRoles(Collections.singletonList(selectedRole));
            user.setDepartmentIds(normalizeDepartmentIds(selectedRole, request.getDepartmentIds()));

            if (request.getActive() != null) {
                user.setActive(request.getActive());
            }

            User savedUser = userRepository.save(user);
            return ResponseEntity.ok(toResponse(savedUser));
        } catch (IllegalArgumentException exception) {
            HttpStatus status = "User not found".equals(exception.getMessage())
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status)
                    .body(new ErrorResponse(status == HttpStatus.NOT_FOUND ? "Not Found" : "Bad Request", exception.getMessage()));
        }
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateUserStatus(@PathVariable String id, @RequestParam boolean active) {
        var userOptional = userRepository.findById(id);
        if (userOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Not Found", "User not found"));
        }

        User user = userOptional.get();
        user.setActive(active);
        User savedUser = userRepository.save(user);

        return ResponseEntity.ok(toResponse(savedUser));
    }

    /**
     * POST /api/users/me/fcm-token: Update current user's FCM token for push notifications
     */
    @PostMapping("/me/fcm-token")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateFcmToken(@RequestBody FcmTokenRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = auth.getName();

        return userRepository.findByUsername(currentUsername)
                .map(user -> {
                    user.setFcmToken(request.getToken());
                    userRepository.save(user);
                    return ResponseEntity.ok().build();
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
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

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                (user.getRoles() != null && !user.getRoles().isEmpty()) ? user.getRoles().get(0).name() : null,
                user.getDepartmentIds() != null ? user.getDepartmentIds() : Collections.emptyList(),
                user.isActive(),
                user.getName()
        );
    }

    /**
     * DTO for FCM Token
     */
    static class FcmTokenRequest {
        private String token;

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }
    }

    /**
     * Simple error response DTO
     */
    static class ErrorResponse {
        public String error;
        public String message;

        ErrorResponse(String error, String message) {
            this.error = error;
            this.message = message;
        }

        public String getError() {
            return error;
        }

        public String getMessage() {
            return message;
        }
    }
}
