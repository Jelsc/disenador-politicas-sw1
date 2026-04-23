package com.tuapp.backend.users.presentation;

import com.tuapp.backend.users.application.CreateUserRequest;
import com.tuapp.backend.users.application.CreateUserUseCase;
import com.tuapp.backend.users.application.LoginRequest;
import com.tuapp.backend.users.application.LoginResponse;
import com.tuapp.backend.users.application.LoginUseCase;
import com.tuapp.backend.users.application.UserResponse;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * AuthController: handles authentication endpoints (login)
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:80"})
public class AuthController {

    private final LoginUseCase loginUseCase;

    public AuthController(LoginUseCase loginUseCase) {
        this.loginUseCase = loginUseCase;
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
