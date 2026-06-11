package com.tuapp.backend.config;

import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.Department;
import com.tuapp.backend.users.infrastructure.MongoDepartmentRepository;
import com.tuapp.backend.users.infrastructure.MongoUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.List;

/**
 * DataInitializer: initializes the database with seed data
 * including departments and 3 operators per department.
 */
@Configuration
@Profile("!test")
public class DataInitializer {

    private static final String PASSWORD = "contra123";

    @Bean
    public CommandLineRunner initializeData(MongoUserRepository userRepository,
                                            MongoDepartmentRepository departmentRepository,
                                            PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() > 0) {
                System.out.println("⚠️  Users already exist, skipping data initialization.");
                return;
            }

            String encodedPassword = passwordEncoder.encode(PASSWORD);

            // ═══════════════════════════════════════════
            //  DEPARTMENTS
            // ═══════════════════════════════════════════

            Department[] departments = new Department[]{
                    new Department("Asesoría Jurídica",
                            "Asesoramiento legal integral, elaboración de normativas internas, gestión de contratos y representación judicial de la institución."),
                    new Department("Finanzas",
                            "Gestión del presupuesto institucional, contabilidad general, ejecución financiera y control de recursos económicos."),
                    new Department("Recursos Humanos",
                            "Administración del talento humano, gestión de nóminas, reclutamiento, capacitación y clima organizacional."),
                    new Department("Tecnología de la Información",
                            "Infraestructura tecnológica, desarrollo de software, soporte técnico, seguridad informática y transformación digital."),
                    new Department("Compras y Contrataciones",
                            "Gestión de adquisiciones, procesos de licitación, contratación de bienes y servicios, y administración de proveedores."),
                    new Department("Atención al Ciudadano",
                            "Recepción y gestión de reclamos, consultas y solicitudes ciudadanas, ventanilla única y seguimiento de casos."),
                    new Department("Auditoría Interna",
                            "Control interno, fiscalización de procesos, evaluación de riesgos, cumplimiento normativo y auditorías operativas."),
                    new Department("Planificación Estratégica",
                            "Formulación de planes institucionales, definición de metas y objetivos, monitoreo de indicadores y evaluación de resultados."),
                    new Department("Comunicación y Prensa",
                            "Gestión de la comunicación institucional, relaciones públicas, prensa, redes sociales e imagen corporativa."),
                    new Department("Gestión Documental y Archivo",
                            "Organización, digitalización, custodia y conservación de documentos institucionales, gestión de expedientes y archivo central."),
                    new Department("Infraestructura y Servicios",
                            "Mantenimiento de edificios e instalaciones, gestión de servicios generales, limpieza, vigilancia y logística interna."),
                    new Department("Secretaría General",
                            "Gestión de actas, resoluciones y normativas oficiales, trámites administrativos centralizados y coordinación interdepartamental."),
                    new Department("Desarrollo Social",
                            "Diseño y ejecución de programas sociales, asistencia a comunidades vulnerables y coordinación con organizaciones sociales."),
                    new Department("Gestión Ambiental",
                            "Supervisión del cumplimiento ambiental, gestión de residuos, educación ecológica y monitoreo de impacto ambiental.")
            };

            // Save all departments
            for (Department dept : departments) {
                departmentRepository.save(dept);
            }
            System.out.println("✅ " + departments.length + " departments created.");

            // ═══════════════════════════════════════════
            //  USERS: 3 OPERATORS per department
            // ═══════════════════════════════════════════

            List<String[]> deptUsers = List.of(
                    // Asesoría Jurídica
                    new String[]{"legal.juan", "juan.legal", departments[0].getId()},
                    new String[]{"legal.maria", "maria.legal", departments[0].getId()},
                    new String[]{"legal.carlos", "carlos.legal", departments[0].getId()},
                    // Finanzas
                    new String[]{"finanzas.ana", "ana.finanzas", departments[1].getId()},
                    new String[]{"finanzas.luis", "luis.finanzas", departments[1].getId()},
                    new String[]{"finanzas.pedro", "pedro.finanzas", departments[1].getId()},
                    // Recursos Humanos
                    new String[]{"rrhh.sofia", "sofia.rrhh", departments[2].getId()},
                    new String[]{"rrhh.pablo", "pablo.rrhh", departments[2].getId()},
                    new String[]{"rrhh.laura", "laura.rrhh", departments[2].getId()},
                    // Tecnología
                    new String[]{"tecnologia.miguel", "miguel.tecnologia", departments[3].getId()},
                    new String[]{"tecnologia.andrea", "andrea.tecnologia", departments[3].getId()},
                    new String[]{"tecnologia.diego", "diego.tecnologia", departments[3].getId()},
                    // Compras y Contrataciones
                    new String[]{"compras.rosa", "rosa.compras", departments[4].getId()},
                    new String[]{"compras.jorge", "jorge.compras", departments[4].getId()},
                    new String[]{"compras.claudia", "claudia.compras", departments[4].getId()},
                    // Atención al Ciudadano
                    new String[]{"atencion.patricia", "patricia.atencion", departments[5].getId()},
                    new String[]{"atencion.ricardo", "ricardo.atencion", departments[5].getId()},
                    new String[]{"atencion.veronica", "veronica.atencion", departments[5].getId()},
                    // Auditoría Interna
                    new String[]{"auditoria.fernando", "fernando.auditoria", departments[6].getId()},
                    new String[]{"auditoria.monica", "monica.auditoria", departments[6].getId()},
                    new String[]{"auditoria.alberto", "alberto.auditoria", departments[6].getId()},
                    // Planificación Estratégica
                    new String[]{"planificacion.carmen", "carmen.planificacion", departments[7].getId()},
                    new String[]{"planificacion.hugo", "hugo.planificacion", departments[7].getId()},
                    new String[]{"planificacion.daniela", "daniela.planificacion", departments[7].getId()},
                    // Comunicación y Prensa
                    new String[]{"comunicacion.gabriel", "gabriel.comunicacion", departments[8].getId()},
                    new String[]{"comunicacion.valentina", "valentina.comunicacion", departments[8].getId()},
                    new String[]{"comunicacion.martin", "martin.comunicacion", departments[8].getId()},
                    // Gestión Documental y Archivo
                    new String[]{"archivo.marcela", "marcela.archivo", departments[9].getId()},
                    new String[]{"archivo.raul", "raul.archivo", departments[9].getId()},
                    new String[]{"archivo.gloria", "gloria.archivo", departments[9].getId()},
                    // Infraestructura y Servicios
                    new String[]{"infraestructura.oscar", "oscar.infraestructura", departments[10].getId()},
                    new String[]{"infraestructura.elena", "elena.infraestructura", departments[10].getId()},
                    new String[]{"infraestructura.victor", "victor.infraestructura", departments[10].getId()},
                    // Secretaría General
                    new String[]{"secretaria.cristina", "cristina.secretaria", departments[11].getId()},
                    new String[]{"secretaria.alex", "alex.secretaria", departments[11].getId()},
                    new String[]{"secretaria.martha", "martha.secretaria", departments[11].getId()},
                    // Desarrollo Social
                    new String[]{"social.graciela", "graciela.social", departments[12].getId()},
                    new String[]{"social.felipe", "felipe.social", departments[12].getId()},
                    new String[]{"social.irene", "irene.social", departments[12].getId()},
                    // Gestión Ambiental
                    new String[]{"ambiental.sergio", "sergio.ambiental", departments[13].getId()},
                    new String[]{"ambiental.natalia", "natalia.ambiental", departments[13].getId()},
                    new String[]{"ambiental.mauricio", "mauricio.ambiental", departments[13].getId()}
            );

            for (String[] u : deptUsers) {
                String username = u[0];
                String emailPrefix = u[1];
                String departmentId = u[2];

                User user = new User();
                user.setUsername(username);
                user.setEmail(emailPrefix + "@gmail.com");
                user.setPassword(encodedPassword);
                user.setRoles(Collections.singletonList(Role.OPERATOR));
                user.setDepartmentIds(List.of(departmentId));
                user.setActive(true);
                userRepository.save(user);
            }

            System.out.println("✅ " + deptUsers.size() + " department operators created (password: " + PASSWORD + ").");

            // ═══════════════════════════════════════════
            //  SPECIAL ROLES
            // ═══════════════════════════════════════════

            // Admin
            User admin = new User();
            admin.setUsername("admin");
            admin.setEmail("admin@tuapp.com");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRoles(Collections.singletonList(Role.ADMIN));
            admin.setDepartmentIds(Collections.emptyList());
            admin.setActive(true);
            userRepository.save(admin);

            // Designer
            User designer = new User();
            designer.setUsername("designer");
            designer.setEmail("designer@tuapp.com");
            designer.setPassword(passwordEncoder.encode("designer123"));
            designer.setRoles(Collections.singletonList(Role.DESIGNER));
            designer.setDepartmentIds(Collections.emptyList());
            designer.setActive(true);
            userRepository.save(designer);

            // Auditor
            User auditor = new User();
            auditor.setUsername("auditor");
            auditor.setEmail("auditor@tuapp.com");
            auditor.setPassword(passwordEncoder.encode("auditor123"));
            auditor.setRoles(Collections.singletonList(Role.AUDITOR));
            auditor.setDepartmentIds(Collections.emptyList());
            auditor.setActive(true);
            userRepository.save(auditor);

            // Client
            User client = new User();
            client.setUsername("client");
            client.setEmail("cliente@example.com");
            client.setPassword(passwordEncoder.encode("client123"));
            client.setRoles(Collections.singletonList(Role.CLIENT));
            client.setDepartmentIds(Collections.emptyList());
            client.setActive(true);
            userRepository.save(client);

            System.out.println("✅ Special users created:");
            System.out.println("   - admin    / admin123");
            System.out.println("   - designer / designer123");
            System.out.println("   - auditor  / auditor123");
            System.out.println("   - client   / client123");
            System.out.println("========================================");
            System.out.println("Total: " + departments.length + " departments, " +
                    (deptUsers.size() + 4) + " users.");
        };
    }
}
