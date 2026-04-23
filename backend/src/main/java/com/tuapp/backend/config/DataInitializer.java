package com.tuapp.backend.config;

import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.infrastructure.MongoUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;

/**
 * DataInitializer: initializes the database with seed data
 */
@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner initializeData(MongoUserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            // Only initialize if no users exist
            if (userRepository.count() == 0) {
                // Create default admin user
                User admin = new User();
                admin.setUsername("admin");
                admin.setEmail("admin@tuapp.com");
                admin.setPassword(passwordEncoder.encode("admin123"));
                admin.setRoles(Collections.singletonList(Role.ADMIN));
                admin.setDepartmentId(null);
                admin.setActive(true);

                // Create default designer user
                User designer = new User();
                designer.setUsername("designer");
                designer.setEmail("designer@tuapp.com");
                designer.setPassword(passwordEncoder.encode("designer123"));
                designer.setRoles(Collections.singletonList(Role.DESIGNER));
                designer.setDepartmentId(null);
                designer.setActive(true);

                // Create default operator user
                User operator = new User();
                operator.setUsername("operator");
                operator.setEmail("operator@tuapp.com");
                operator.setPassword(passwordEncoder.encode("operator123"));
                operator.setRoles(Collections.singletonList(Role.OPERATOR));
                operator.setDepartmentId(null);
                operator.setActive(true);

                // Save users
                userRepository.save(admin);
                userRepository.save(designer);
                userRepository.save(operator);

                System.out.println("✅ Default users initialized successfully");
                System.out.println("   - admin / admin123");
                System.out.println("   - designer / designer123");
                System.out.println("   - operator / operator123");
            }
        };
    }
}
