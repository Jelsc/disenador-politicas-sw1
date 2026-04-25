package com.tuapp.backend.config;

import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.Department;
import com.tuapp.backend.users.infrastructure.MongoDepartmentRepository;
import com.tuapp.backend.users.infrastructure.MongoUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.List;

/**
 * DataInitializer: initializes the database with seed data
 */
@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner initializeData(MongoUserRepository userRepository,
                                            MongoDepartmentRepository departmentRepository,
                                            PasswordEncoder passwordEncoder) {
        return args -> {
            // Only initialize if no users exist
            if (userRepository.count() == 0) {
                Department operationsDepartment = new Department();
                operationsDepartment.setName("Operaciones");
                operationsDepartment.setDescription("Departamento operativo inicial para funcionarios semilla");
                operationsDepartment.setActive(true);
                Department savedOperationsDepartment = departmentRepository.save(operationsDepartment);

                // Create default admin user
                User admin = new User();
                admin.setUsername("admin");
                admin.setEmail("admin@tuapp.com");
                admin.setPassword(passwordEncoder.encode("admin123"));
                admin.setRoles(Collections.singletonList(Role.ADMIN));
                admin.setDepartmentIds(Collections.emptyList());
                admin.setActive(true);

                // Create default designer user
                User designer = new User();
                designer.setUsername("designer");
                designer.setEmail("designer@tuapp.com");
                designer.setPassword(passwordEncoder.encode("designer123"));
                designer.setRoles(Collections.singletonList(Role.DESIGNER));
                designer.setDepartmentIds(Collections.emptyList());
                designer.setActive(true);

                // Create default operator user
                User operator = new User();
                operator.setUsername("operator");
                operator.setEmail("operator@tuapp.com");
                operator.setPassword(passwordEncoder.encode("operator123"));
                operator.setRoles(Collections.singletonList(Role.OPERATOR));
                operator.setDepartmentIds(List.of(savedOperationsDepartment.getId()));
                operator.setActive(true);

                User client = new User();
                client.setUsername("client");
                client.setEmail("client@tuapp.com");
                client.setPassword(passwordEncoder.encode("client123"));
                client.setRoles(Collections.singletonList(Role.CLIENT));
                client.setDepartmentIds(Collections.emptyList());
                client.setActive(true);

                // Save users
                userRepository.save(admin);
                userRepository.save(designer);
                userRepository.save(operator);
                userRepository.save(client);

                System.out.println("✅ Default users initialized successfully");
                System.out.println("   - admin / admin123");
                System.out.println("   - designer / designer123");
                System.out.println("   - operator / operator123");
                System.out.println("   - client / client123");
            }
        };
    }
}
