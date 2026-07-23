package com.tuapp.backend.policies.operation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tuapp.backend.documents.application.DocumentRepositoryService;
import com.tuapp.backend.policies.application.PolicyService;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.operation.dto.ProcedureTrackingResponse;
import com.tuapp.backend.policies.operation.dto.ClientLookupStatus;
import com.tuapp.backend.policies.operation.dto.ClientLookupUserResponse;
import com.tuapp.backend.shared.infrastructure.notifications.PushNotificationService;
import com.tuapp.backend.users.domain.DepartmentRepository;
import com.tuapp.backend.users.domain.Role;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcedureOperationServiceTest {
    @Mock private PolicyService policyService;
    @Mock private UserRepository userRepository;
    @Mock private ProcedureMongoRepository procedureRepository;
    @Mock private ProcedureTaskMongoRepository taskRepository;
    @Mock private ProcedureNotificationMongoRepository notificationRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private PushNotificationService pushNotificationService;
    @Mock private DocumentRepositoryService documentRepositoryService;

    private ProcedureOperationService service;

    @BeforeEach
    void setUp() {
        service = new ProcedureOperationService(
                policyService,
                userRepository,
                procedureRepository,
                taskRepository,
                notificationRepository,
                departmentRepository,
                new ObjectMapper(),
                passwordEncoder,
                pushNotificationService,
                documentRepositoryService
        );
    }

    @Test
    void clientLookupReturnsConflictWhenCiAndEmailBelongToDifferentUsers() {
        User ciUser = user("ci-1", "111", "ci@example.com", "CI User");
        User emailUser = user("mail-1", "222", "mail@example.com", "Email User");
        when(userRepository.findByUsername("111")).thenReturn(Optional.of(ciUser));
        when(userRepository.findByEmail("mail@example.com")).thenReturn(Optional.of(emailUser));

        var response = service.clientLookup("111", "mail@example.com", "operator");

        assertEquals(ClientLookupStatus.CONFLICT, response.getStatus());
        assertNotNull(response.getClientByCi());
        assertNotNull(response.getClientByEmail());
    }

    @Test
    void createProcedureReusesExistingClientWhenCiAndEmailMatchSameUser() {
        User operator = user("op-1", "operator", "op@example.com", "Operator");
        operator.setDepartmentIds(List.of("dept-1"));
        User client = user("client-1", "1234567", "cliente@example.com", "Client One");

        when(userRepository.findByUsername("operator")).thenReturn(Optional.of(operator));
        when(userRepository.findByUsername("1234567")).thenReturn(Optional.of(client));
        when(userRepository.findByEmail("cliente@example.com")).thenReturn(Optional.of(client));
        when(policyService.getPublishedPolicyForExecution("policy-1")).thenReturn(policy());
        when(procedureRepository.save(any())).thenAnswer(invocation -> {
            ProcedureDocument procedure = invocation.getArgument(0);
            procedure.setId("proc-1");
            return procedure;
        });

        ProcedureDocument result = service.createProcedure(request(), "operator");

        assertEquals("client-1", result.getClientId());
        assertEquals("1234567", result.getClientCi());
        verify(userRepository, never()).save(any());
    }

    @Test
    void createProcedureThrowsConflictWhenCiAndEmailBelongToDifferentUsers() {
        User operator = user("op-1", "operator", "op@example.com", "Operator");
        operator.setDepartmentIds(List.of("dept-1"));
        when(userRepository.findByUsername("operator")).thenReturn(Optional.of(operator));
        when(userRepository.findByUsername("1234567")).thenReturn(Optional.of(user("client-1", "1234567", "one@example.com", "Client One")));
        when(userRepository.findByEmail("two@example.com")).thenReturn(Optional.of(user("client-2", "7654321", "two@example.com", "Client Two")));
        when(policyService.getPublishedPolicyForExecution("policy-1")).thenReturn(policy());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.createProcedure(request("1234567", "two@example.com"), "operator"));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(procedureRepository, never()).save(any());
    }

    @Test
    void createProcedureCreatesNewClientWhenNeitherLookupExists() {
        User operator = user("op-1", "operator", "op@example.com", "Operator");
        operator.setDepartmentIds(List.of("dept-1"));
        when(userRepository.findByUsername("operator")).thenReturn(Optional.of(operator));
        when(userRepository.findByUsername("1234567")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("cliente@example.com")).thenReturn(Optional.empty());
        when(policyService.getPublishedPolicyForExecution("policy-1")).thenReturn(policy());
        when(passwordEncoder.encode("1234567")).thenReturn("hashed");
        when(userRepository.save(any())).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId("client-new");
            return user;
        });
        when(procedureRepository.save(any())).thenAnswer(invocation -> {
            ProcedureDocument procedure = invocation.getArgument(0);
            procedure.setId("proc-1");
            return procedure;
        });

        ProcedureDocument result = service.createProcedure(request(), "operator");

        assertEquals("client-new", result.getClientId());
        verify(userRepository).save(any());
    }

    @Test
    void myProceduresIncludesInvitedUsersAndTaskAssignees() {
        ProcedureDocument created = ProcedureDocument.builder()
                .id("proc-created")
                .createdBy("alex")
                .policyId("policy-1")
                .policyName("Policy")
                .status("OPEN")
                .createdAt(LocalDateTime.now().minusDays(1))
                .invitedUsers(List.of())
                .build();
        ProcedureDocument invited = ProcedureDocument.builder()
                .id("proc-invited")
                .createdBy("someone-else")
                .policyId("policy-2")
                .policyName("Policy 2")
                .status("OPEN")
                .createdAt(LocalDateTime.now())
                .invitedUsers(List.of("alex"))
                .build();
        ProcedureDocument assigned = ProcedureDocument.builder()
                .id("proc-assigned")
                .createdBy("someone-else")
                .policyId("policy-3")
                .policyName("Policy 3")
                .status("OPEN")
                .createdAt(LocalDateTime.now().minusHours(2))
                .invitedUsers(List.of())
                .build();

        when(userRepository.findByUsername("alex")).thenReturn(Optional.of(user("u-1", "alex", "alex@example.com", "Alex")));
        when(procedureRepository.findAll()).thenReturn(List.of(created, invited, assigned));
        when(taskRepository.findByAssignedToOrderByCreatedAtDesc("alex")).thenReturn(List.of(ProcedureTaskDocument.builder().procedureId("proc-assigned").assignedTo("alex").build()));

        List<ProcedureTrackingResponse> procedures = service.myProcedures("alex");

        assertEquals(3, procedures.size());
        assertEquals("proc-invited", procedures.get(0).getId());
        assertEquals(List.of("alex"), procedures.get(0).getInvitedUsers());
    }

    @Test
    void clientSuggestionsReturnsPartialClientMatchesOrderedByRelevance() {
        User juana = user("client-1", "1234567", "juana@gmail.com", "Juana Pérez");
        User julian = user("client-2", "7654321", "julian@gmail.com", "Julián Rojas");
        User operator = new User();
        operator.setId("op-1");
        operator.setUsername("operator");
        operator.setEmail("operator@example.com");
        operator.setRoles(List.of());
        operator.setActive(true);

        when(userRepository.findAll()).thenReturn(List.of(juana, julian, operator));

        List<ClientLookupUserResponse> suggestions = service.clientSuggestions("jua", 5, "operator");

        assertEquals(1, suggestions.size());
        assertEquals("1234567", suggestions.get(0).getUsername());
        assertEquals("juana@gmail.com", suggestions.get(0).getEmail());
    }

    @Test
    void completeTaskPreservesExistingSignatureMetadataWhenMergingValues() {
        ProcedureDocument procedure = ProcedureDocument.builder()
                .id("proc-1")
                .policyId("policy-1")
                .policyName("Policy")
                .clientCi("1234567")
                .values(new HashMap<>())
                .build();
        ProcedureTaskDocument task = ProcedureTaskDocument.builder()
                .id("task-1")
                .procedureId("proc-1")
                .policyId("policy-1")
                .taskType("CLIENT_TASK")
                .assignedTo("client-1")
                .status("ASSIGNED")
                .formValues(new HashMap<>(Map.of(
                        "signatureField", "FIRMADA POR CLIENTE",
                        "signatureField_signedAt", "2026-07-21T10:00:00",
                        "signatureField_signatureBase64", "base64-signature"
                )))
                .build();

        when(taskRepository.findById("task-1")).thenReturn(Optional.of(task));
        when(procedureRepository.findById("proc-1")).thenReturn(Optional.of(procedure));
        when(policyService.getPublishedPolicyForExecution("policy-1")).thenReturn(policy());
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CompleteTaskRequest request = new CompleteTaskRequest();
        request.setValues(new HashMap<>(Map.of("signatureField", "[FIRMADA]", "answer", "ok")));

        ProcedureTaskDocument result = service.completeTask("task-1", request, "client-1");

        assertEquals("[FIRMADA]", result.getFormValues().get("signatureField"));
        assertEquals("base64-signature", result.getFormValues().get("signatureField_signatureBase64"));
        assertEquals("2026-07-21T10:00:00", result.getFormValues().get("signatureField_signedAt"));
        assertEquals("ok", result.getFormValues().get("answer"));
        assertTrue(result.getFormValues().containsKey("signatureField_signatureBase64"));
    }

    private CreateProcedureRequest request() {
        return request("1234567", "cliente@example.com");
    }

    private CreateProcedureRequest request(String clientCi, String clientEmail) {
        CreateProcedureRequest request = new CreateProcedureRequest();
        request.setPolicyId("policy-1");
        request.setClientFullName("Client One");
        request.setClientCi(clientCi);
        request.setClientEmail(clientEmail);
        request.setValues(Map.of());
        return request;
    }

    private Policy policy() {
        return Policy.builder()
                .id("policy-1")
                .name("Policy")
                .rules("{\"nodes\":[{\"id\":\"start\",\"type\":\"START\",\"departmentId\":\"dept-1\"}],\"connectors\":[]}")
                .build();
    }

    private User user(String id, String username, String email, String name) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setName(name);
        user.setRoles(List.of(Role.CLIENT));
        return user;
    }
}
