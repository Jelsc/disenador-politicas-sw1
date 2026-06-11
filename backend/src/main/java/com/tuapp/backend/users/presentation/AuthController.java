package com.tuapp.backend.users.presentation;

import com.tuapp.backend.users.application.LoginRequest;
import com.tuapp.backend.users.application.LoginResponse;
import com.tuapp.backend.users.application.LoginUseCase;
import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * AuthController: handles authentication and registration endpoints
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final LoginUseCase loginUseCase;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(LoginUseCase loginUseCase,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder) {
        this.loginUseCase = loginUseCase;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * POST /api/auth/login: authenticate user and return JWT token
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            LoginResponse response = loginUseCase.execute(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Unauthorized", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/register: register a new CLIENT user (from mobile app)
     * The client chooses their own password (CI is no longer the default).
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        // Validate required fields
        if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Bad Request", "CI (username) is required"));
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Bad Request", "Password is required"));
        }
        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Bad Request", "Email is required"));
        }
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Bad Request", "Full name is required"));
        }

        String username = request.getUsername().trim();
        String email = request.getEmail().trim();

        // Check if username already exists
        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse("Conflict", "El CI ya está registrado. Iniciá sesión."));
        }

        // Check if email already exists
        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse("Conflict", "El email ya está registrado."));
        }

        // Create new CLIENT user
        User client = new User();
        client.setUsername(username);
        client.setEmail(email);
        client.setPassword(passwordEncoder.encode(request.getPassword().trim()));
        client.setRoles(List.of(Role.CLIENT));
        client.setDepartmentIds(List.of());
        client.setName(request.getName().trim());
        client.setActive(true);
        userRepository.save(client);

        // Auto-login: generate JWT and return it
        LoginRequest loginReq = new LoginRequest(username, request.getPassword().trim());
        try {
            LoginResponse loginResponse = loginUseCase.execute(loginReq);
            return ResponseEntity.status(HttpStatus.CREATED).body(loginResponse);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of("message", "Registrado correctamente. Iniciá sesión."));
        }
    }

    /**
     * POST /api/auth/change-password: change current user's password
     * Requires authentication. Validates current password before updating.
     */
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();

        if (request.getCurrentPassword() == null || request.getCurrentPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Bad Request", "La contraseña actual es requerida"));
        }
        if (request.getNewPassword() == null || request.getNewPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Bad Request", "La nueva contraseña es requerida"));
        }
        if (request.getNewPassword().length() < 6) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Bad Request", "La nueva contraseña debe tener al menos 6 caracteres"));
        }

        var userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Not Found", "Usuario no encontrado"));
        }

        User user = userOpt.get();

        // Verify current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Unauthorized", "La contraseña actual no es correcta"));
        }

        // Update password
        user.setPassword(passwordEncoder.encode(request.getNewPassword().trim()));
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Contraseña actualizada correctamente"));
    }

    /**
     * Request DTO for client registration
     */
    static class RegisterRequest {
        private String username;   // CI
        private String password;   // chosen password
        private String email;
        private String name;       // full name

        public RegisterRequest() {}

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }

    /**
     * Request DTO for password change
     */
    static class ChangePasswordRequest {
        private String currentPassword;
        private String newPassword;

        public ChangePasswordRequest() {}

        public String getCurrentPassword() { return currentPassword; }
        public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }
        public String getNewPassword() { return newPassword; }
        public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
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

        public String getError() { return error; }
        public String getMessage() { return message; }
    }
}
