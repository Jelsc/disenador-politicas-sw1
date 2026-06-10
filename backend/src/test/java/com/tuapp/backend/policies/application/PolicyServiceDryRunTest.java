package com.tuapp.backend.policies.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tuapp.backend.policies.collaboration.PolicyNotificationWebSocketHandler;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.domain.PolicyRepository;
import com.tuapp.backend.policies.infrastructure.PolicyAutosaveMongoRepository;
import com.tuapp.backend.policies.infrastructure.PolicyChangeLogMongoRepository;
import com.tuapp.backend.policies.infrastructure.PolicyVersionDocument;
import com.tuapp.backend.policies.infrastructure.PolicyVersionMongoRepository;
import com.tuapp.backend.policies.presentation.dto.PolicyDryRunRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PolicyServiceDryRunTest {

    private PolicyRepository policyRepository;
    private PolicyVersionMongoRepository versionRepository;
    private PolicyService service;

    @BeforeEach
    void setUp() {
        policyRepository = mock(PolicyRepository.class);
        versionRepository = mock(PolicyVersionMongoRepository.class);
        PolicyAutosaveMongoRepository autosaveRepository = mock(PolicyAutosaveMongoRepository.class);
        PolicyChangeLogMongoRepository changeLogRepository = mock(PolicyChangeLogMongoRepository.class);
        PolicyNotificationWebSocketHandler notificationWebSocketHandler = mock(PolicyNotificationWebSocketHandler.class);
        service = new PolicyService(
                policyRepository,
                versionRepository,
                autosaveRepository,
                changeLogRepository,
                mock(com.tuapp.backend.users.domain.UserRepository.class),
                new ObjectMapper(),
                notificationWebSocketHandler
        );
    }

    @Test
    void returnsDeterministicFindingsForHeavyRiskySnapshotsWithoutMutatingState() {
        PolicyDryRunRequest request = new PolicyDryRunRequest("Política operativa", sampleRules());

        PolicyDryRunReportResponse report = service.verifyDryRun(request);

        assertThat(report.getStatus()).isEqualTo("error");
        assertThat(report.getWarnings()).anyMatch(message -> message.contains("Heavy forms"));
        assertThat(report.getBottlenecks()).contains("Recepción");
        assertThat(report.getErrors()).anyMatch(message -> message.contains("signature field"));
        verifyNoInteractions(policyRepository, versionRepository);
    }

    @Test
    void publishStillBlocksInvalidRulesDuringVersionPublication() {
        Policy policy = Policy.builder()
                .id("policy-1")
                .name("Política operativa")
                .createdBy("alice")
                .status("BORRADOR")
                .build();

        PolicyVersionDocument version = PolicyVersionDocument.builder()
                .id("version-1")
                .policyId("policy-1")
                .name("Versión 1")
                .version("1.0.0")
                .description("Borrador")
                .diagramSnapshotJson(sampleRules())
                .status("BORRADOR")
                .published(false)
                .build();

        when(policyRepository.findById("policy-1")).thenReturn(Optional.of(policy));
        when(versionRepository.findById("version-1")).thenReturn(Optional.of(version));

        assertThatThrownBy(() -> service.publishVersion("policy-1", "version-1", "alice", false))
                .isInstanceOf(ResponseStatusException.class);

        verify(versionRepository, never()).save(version);
        verify(policyRepository, never()).save(policy);
    }

    private String sampleRules() {
        return """
                {
                  "version": 1,
                  "departments": [
                    {"id": "dep-1", "name": "Operaciones"}
                  ],
                  "nodes": [
                    {"id": "start-1", "type": "START", "label": "Inicio", "departmentId": "dep-1", "x": 60, "y": 80},
                    {
                      "id": "task-1",
                      "type": "TASK",
                      "label": "Recepción",
                      "departmentId": "dep-1",
                      "x": 260,
                      "y": 80,
                      "config": {
                        "taskType": "MANUAL",
                        "estimatedTime": "15m",
                        "requiresSignature": true,
                        "form": {
                          "title": "Formulario operativo",
                          "fields": [
                            {"id": "f1", "type": "SHORT_TEXT", "label": "Dato 1", "order": 1},
                            {"id": "f2", "type": "SHORT_TEXT", "label": "Dato 2", "order": 2},
                            {"id": "f3", "type": "SHORT_TEXT", "label": "Dato 3", "order": 3},
                            {"id": "f4", "type": "SHORT_TEXT", "label": "Dato 4", "order": 4},
                            {"id": "f5", "type": "SHORT_TEXT", "label": "Dato 5", "order": 5},
                            {"id": "f6", "type": "SHORT_TEXT", "label": "Dato 6", "order": 6},
                            {"id": "f7", "type": "SHORT_TEXT", "label": "Dato 7", "order": 7},
                            {"id": "f8", "type": "SHORT_TEXT", "label": "Dato 8", "order": 8},
                            {"id": "f9", "type": "SHORT_TEXT", "label": "Dato 9", "order": 9},
                            {"id": "f10", "type": "SHORT_TEXT", "label": "Dato 10", "order": 10},
                            {"id": "f11", "type": "SHORT_TEXT", "label": "Dato 11", "order": 11},
                            {"id": "f12", "type": "FILE", "label": "Adjunto", "order": 12}
                          ]
                        }
                      }
                    },
                    {"id": "end-1", "type": "END", "label": "Fin", "departmentId": "dep-1", "x": 520, "y": 80}
                  ],
                  "connectors": [
                    {"id": "c1", "sourceId": "start-1", "targetId": "task-1"},
                    {"id": "c2", "sourceId": "task-1", "targetId": "end-1"}
                  ]
                }
                """;
    }
}
