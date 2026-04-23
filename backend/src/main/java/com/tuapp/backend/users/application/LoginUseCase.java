package com.tuapp.backend.users.application;

import com.tuapp.backend.config.JwtTokenProvider;
import com.tuapp.backend.shared.application.UseCase;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * LoginUseCase: authenticates a user and generates JWT token.
 * Validates credentials and returns a LoginResponse with token.
 */
@Service
public class LoginUseCase implements UseCase<LoginRequest, LoginResponse> {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.jwt.expiration}")
    private long jwtExpiration;

    public LoginUseCase(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public LoginResponse execute(LoginRequest request) {
        // Find user by username
        Optional<User> userOptional = userRepository.findByUsername(request.getUsername());
        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        User user = userOptional.get();

        // Verify password
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        // Check if user is active
        if (!user.isActive()) {
            throw new IllegalArgumentException("User account is inactive");
        }

        // Generate JWT token with user claims
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", user.getRoles());
        claims.put("departmentId", user.getDepartmentId());

        String token = jwtTokenProvider.generateToken(user.getUsername(), claims);

        // Return response with token
        return new LoginResponse(
                token,
                user.getUsername(),
                user.getRoles().get(0).name(),
                jwtExpiration
        );
    }
}
