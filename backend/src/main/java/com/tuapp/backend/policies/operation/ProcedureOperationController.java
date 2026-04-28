package com.tuapp.backend.policies.operation;

import com.tuapp.backend.policies.operation.dto.ProcedureTrackingResponse;
import com.tuapp.backend.policies.domain.Policy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operations")
@PreAuthorize("isAuthenticated()")
public class ProcedureOperationController {
    private final ProcedureOperationService service;

    public ProcedureOperationController(ProcedureOperationService service) {
        this.service = service;
    }

    @GetMapping("/startable-policies")
    @PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
    public ResponseEntity<List<Policy>> startablePolicies(Authentication authentication) {
        return ResponseEntity.ok(service.startablePolicies(username(authentication)));
    }

    @GetMapping("/me/context")
    @PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> currentUserContext(Authentication authentication) {
        return ResponseEntity.ok(service.currentUserContext(username(authentication)));
    }

    @PostMapping("/procedures")
    @PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
    public ResponseEntity<ProcedureDocument> createProcedure(@RequestBody CreateProcedureRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createProcedure(request, username(authentication)));
    }

    @GetMapping("/procedures/mine")
    public ResponseEntity<List<ProcedureTrackingResponse>> myProcedures(Authentication authentication) {
        return ResponseEntity.ok(service.myProcedures(username(authentication)));
    }

    @GetMapping("/tasks/inbox")
    @PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
    public ResponseEntity<List<ProcedureTaskDocument>> departmentInbox(Authentication authentication) {
        return ResponseEntity.ok(service.departmentInbox(username(authentication)));
    }

    @GetMapping("/tasks/mine")
    @PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
    public ResponseEntity<List<ProcedureTaskDocument>> myTasks(Authentication authentication) {
        return ResponseEntity.ok(service.myTasks(username(authentication)));
    }

    @PostMapping("/tasks/{taskId}/accept")
    @PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
    public ResponseEntity<ProcedureTaskDocument> acceptTask(@PathVariable String taskId, Authentication authentication) {
        return ResponseEntity.ok(service.acceptTask(taskId, username(authentication)));
    }

    @PostMapping("/tasks/{taskId}/complete")
    @PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
    public ResponseEntity<ProcedureTaskDocument> completeTask(@PathVariable String taskId, @RequestBody CompleteTaskRequest request, Authentication authentication) {
        return ResponseEntity.ok(service.completeTask(taskId, request, username(authentication)));
    }

    @GetMapping("/notifications/mine")
    public ResponseEntity<List<ProcedureNotificationDocument>> myNotifications(Authentication authentication) {
        return ResponseEntity.ok(service.myNotifications(username(authentication)));
    }

    @GetMapping("/notifications/unread-count")
    public ResponseEntity<Map<String, Long>> unreadNotificationCount(Authentication authentication) {
        return ResponseEntity.ok(Map.of("count", service.unreadNotificationCount(username(authentication))));
    }

    @PostMapping("/notifications/{notificationId}/read")
    public ResponseEntity<ProcedureNotificationDocument> markNotificationRead(@PathVariable String notificationId, Authentication authentication) {
        return ResponseEntity.ok(service.markNotificationRead(notificationId, username(authentication)));
    }

    @PostMapping("/procedures/{procedureId}/signature")
    @PreAuthorize("hasRole('CLIENT')")
    public ResponseEntity<ProcedureDocument> submitClientSignature(@PathVariable String procedureId, @RequestBody ClientSignatureRequest request, Authentication authentication) {
        return ResponseEntity.ok(service.submitClientSignature(procedureId, request, username(authentication)));
    }

    private String username(Authentication authentication) {
        return authentication == null ? "anonymous" : authentication.getName();
    }
}
