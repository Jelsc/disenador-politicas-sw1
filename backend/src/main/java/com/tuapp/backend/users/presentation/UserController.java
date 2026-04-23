package com.tuapp.backend.users.presentation;

import com.tuapp.backend.users.application.CreateUserRequest;
import com.tuapp.backend.users.application.CreateUserUseCase;
import com.tuapp.backend.users.application.UserResponse;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

/**
 * UserController: handles user management endpoints
 */
@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:80"})
public class UserController {

    private final CreateUserUseCase createUserUseCase;
    private final UserRepository userRepository;

    public UserController(CreateUserUseCase createUserUseCase, UserRepository userRepository) {
        this.createUserUseCase = createUserUseCase;
        this.userRepository = userRepository;
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
    public ResponseEntity<List<UserResponse>> listUsers() {
        Iterable<User> users = userRepository.findAll();
        List<UserResponse> responses = new ArrayList<>();

        users.forEach(user -> responses.add(new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRoles().get(0).name(),
                user.getDepartmentId(),
                user.isActive()
        )));

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

        User user = userOptional.get();
        UserResponse response = new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRoles().get(0).name(),
                user.getDepartmentId(),
                user.isActive()
        );

        return ResponseEntity.ok(response);
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
