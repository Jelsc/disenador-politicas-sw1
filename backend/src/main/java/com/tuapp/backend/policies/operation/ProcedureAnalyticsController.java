package com.tuapp.backend.policies.operation;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operations/analytics")
@PreAuthorize("hasRole('DESIGNER') or hasRole('ADMIN')")
public class ProcedureAnalyticsController {
    private final ProcedureOperationService service;

    public ProcedureAnalyticsController(ProcedureOperationService service) {
        this.service = service;
    }

    @GetMapping("/learning-events")
    public ResponseEntity<List<Map<String, Object>>> learningEvents() {
        return ResponseEntity.ok(service.learningEvents());
    }
}
