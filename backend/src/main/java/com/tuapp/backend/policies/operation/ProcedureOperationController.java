package com.tuapp.backend.policies.operation;

import com.tuapp.backend.policies.operation.dto.ProcedureTrackingResponse;
import com.tuapp.backend.policies.domain.Policy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/operations")
@PreAuthorize("hasRole('OPERATOR') or hasRole('ADMIN')")
public class ProcedureOperationController {
    private final ProcedureOperationService service;

    public ProcedureOperationController(ProcedureOperationService service) {
        this.service = service;
    }

    @GetMapping("/startable-policies")
    public ResponseEntity<List<Policy>> startablePolicies(Authentication authentication) {
        return ResponseEntity.ok(service.startablePolicies(username(authentication)));
    }

    @PostMapping("/procedures")
    public ResponseEntity<ProcedureDocument> createProcedure(@RequestBody CreateProcedureRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createProcedure(request, username(authentication)));
    }

    @GetMapping("/procedures/mine")
    public ResponseEntity<List<ProcedureTrackingResponse>> myProcedures(Authentication authentication) {
        return ResponseEntity.ok(service.myProcedures(username(authentication)));
    }

    @GetMapping("/tasks/inbox")
    public ResponseEntity<List<ProcedureTaskDocument>> departmentInbox(Authentication authentication) {
        return ResponseEntity.ok(service.departmentInbox(username(authentication)));
    }

    @GetMapping("/tasks/mine")
    public ResponseEntity<List<ProcedureTaskDocument>> myTasks(Authentication authentication) {
        return ResponseEntity.ok(service.myTasks(username(authentication)));
    }

    @PostMapping("/tasks/{taskId}/accept")
    public ResponseEntity<ProcedureTaskDocument> acceptTask(@PathVariable String taskId, Authentication authentication) {
        return ResponseEntity.ok(service.acceptTask(taskId, username(authentication)));
    }

    @PostMapping("/tasks/{taskId}/complete")
    public ResponseEntity<ProcedureTaskDocument> completeTask(@PathVariable String taskId, @RequestBody CompleteTaskRequest request, Authentication authentication) {
        return ResponseEntity.ok(service.completeTask(taskId, request, username(authentication)));
    }

    private String username(Authentication authentication) {
        return authentication == null ? "anonymous" : authentication.getName();
    }
}
