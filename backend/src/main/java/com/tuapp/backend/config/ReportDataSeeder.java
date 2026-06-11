package com.tuapp.backend.config;

import com.tuapp.backend.policies.infrastructure.PolicyDocument;
import com.tuapp.backend.policies.operation.ProcedureDocument;
import com.tuapp.backend.policies.operation.ProcedureTaskDocument;
import com.tuapp.backend.users.domain.Department;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.infrastructure.MongoDepartmentRepository;
import com.tuapp.backend.users.infrastructure.MongoUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Configuration
@Profile("!test")
public class ReportDataSeeder {

    @Bean
    public CommandLineRunner seedReportData(MongoTemplate mongoTemplate,
                                            MongoDepartmentRepository departmentRepository,
                                            MongoUserRepository userRepository) {
        return args -> {
            long proceduresCount = mongoTemplate.getCollection("procedure_tickets").countDocuments();
            if (proceduresCount > 10) {
                System.out.println("🌱 ReportDataSeeder: La base de datos ya tiene " + proceduresCount + " trámites. Skipiando seeder.");
                return;
            }

            System.out.println("🌱 ReportDataSeeder: Iniciando sembrado histórico de reportes...");

            List<Department> departments = departmentRepository.findAll();
            List<User> operators = userRepository.findAll().stream()
                    .filter(u -> u.getRoles() != null && u.getRoles().contains(com.tuapp.backend.users.domain.Role.OPERATOR))
                    .toList();

            User client = userRepository.findByUsername("client").orElse(null);
            if (client == null) {
                System.out.println("🌱 ReportDataSeeder: No se encontró al usuario 'client'. Skipiando.");
                return;
            }

            Random random = new Random();

            for (Department dept : departments) {
                // 1. Crear 1 Política por departamento
                PolicyDocument policy = PolicyDocument.builder()
                        .name("Solicitud General - " + dept.getName())
                        .description("Trámite base para reportes del departamento de " + dept.getName())
                        .version("1.0.0")
                        .status("PUBLISHED")
                        .createdBy("admin")
                        .createdAt(LocalDateTime.now().minusMonths(6))
                        .updatedAt(LocalDateTime.now().minusMonths(6))
                        .build();

                mongoTemplate.save(policy);

                // Obtener operadores de este departamento
                List<User> deptOperators = operators.stream()
                        .filter(o -> o.getDepartmentIds() != null && o.getDepartmentIds().contains(dept.getId()))
                        .toList();

                if (deptOperators.isEmpty()) continue;

                // 2. Crear 50 trámites históricos para esta política
                for (int i = 0; i < 50; i++) {
                    // Generar fecha de creación (últimos 6 meses)
                    int daysAgo = random.nextInt(180);
                    LocalDateTime createdAt = LocalDateTime.now().minusDays(daysAgo).minusHours(random.nextInt(24));
                    
                    String status;
                    int r = random.nextInt(100);
                    if (r < 60) status = "COMPLETED";
                    else if (r < 90) status = "OPEN";
                    else status = "REJECTED";

                    LocalDateTime completedAt = null;
                    if ("COMPLETED".equals(status) || "REJECTED".equals(status)) {
                        // Resuelto entre 1 y 15 días después
                        completedAt = createdAt.plusDays(random.nextInt(15) + 1).plusHours(random.nextInt(12));
                        if (completedAt.isAfter(LocalDateTime.now())) {
                            completedAt = LocalDateTime.now();
                        }
                    }

                    ProcedureDocument procedure = ProcedureDocument.builder()
                            .policyId(policy.getId())
                            .policyName(policy.getName())
                            .status(status)
                            .createdBy("system_seeder")
                            .startDepartmentId(dept.getId())
                            .clientId(client.getId())
                            .clientName(client.getUsername())
                            .clientCi(client.getEmail()) // usaremos email como CI por simplicidad
                            .createdAt(createdAt)
                            .updatedAt(completedAt != null ? completedAt : createdAt.plusDays(1))
                            .completedAt(completedAt)
                            .build();

                    mongoTemplate.save(procedure);

                    // 3. Crear Tareas para este trámite
                    // Tarea 1: Recepción (Asignada y completada o en progreso)
                    createTask(mongoTemplate, procedure, "1", "Recepción de Documentos", "FORM", dept.getId(),
                            deptOperators.get(random.nextInt(deptOperators.size())).getUsername(),
                            createdAt,
                            createdAt.plusHours(1),
                            "COMPLETED".equals(status) || random.nextBoolean() ? createdAt.plusDays(1) : null);

                    // Tarea 2: Análisis (Solo si Recepción se completó)
                    if ("COMPLETED".equals(status)) {
                        createTask(mongoTemplate, procedure, "2", "Análisis " + dept.getName(), "FORM", dept.getId(),
                                deptOperators.get(random.nextInt(deptOperators.size())).getUsername(),
                                createdAt.plusDays(1),
                                createdAt.plusDays(1).plusHours(2),
                                completedAt);
                    }
                }
            }

            System.out.println("🌱 ReportDataSeeder: Sembrado histórico completado.");
        };
    }

    private void createTask(MongoTemplate mongoTemplate, ProcedureDocument proc, String nodeId, String nodeLabel, String nodeType,
                            String deptId, String assignedTo, LocalDateTime createdAt, LocalDateTime assignedAt, LocalDateTime completedAt) {
        String status = completedAt != null ? "COMPLETED" : (assignedAt != null ? "ASSIGNED" : "PENDING");
        ProcedureTaskDocument task = ProcedureTaskDocument.builder()
                .procedureId(proc.getId())
                .policyId(proc.getPolicyId())
                .nodeId(nodeId)
                .nodeLabel(nodeLabel)
                .nodeType(nodeType)
                .taskType("FORM")
                .departmentId(deptId)
                .status(status)
                .assignedTo(assignedTo)
                .createdAt(createdAt)
                .assignedAt(assignedAt)
                .completedAt(completedAt)
                .build();
        mongoTemplate.save(task);
    }
}
