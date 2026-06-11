package com.tuapp.backend.ai.client;

import com.tuapp.backend.policies.operation.ProcedureDocument;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/client")
@PreAuthorize("hasRole('CLIENT')")
public class AiClientAssistantController {

    private final AiClientAssistantService aiClientAssistantService;

    public AiClientAssistantController(AiClientAssistantService aiClientAssistantService) {
        this.aiClientAssistantService = aiClientAssistantService;
    }

    /**
     * POST /api/ai/client/ask
     * Client asks a question, AI responds with info + suggested policy match.
     */
    @PostMapping("/ask")
    public ResponseEntity<ClientAskResponse> ask(
            @Valid @RequestBody ClientAskRequest request,
            Authentication authentication) {
        String clientUsername = authentication.getName();
        ClientAskResponse response = aiClientAssistantService.ask(request.getText(), request.getAudioBase64(), clientUsername);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/ai/client/confirm-ticket
     * Client confirms they want to start the suggested procedure.
     */
    @PostMapping("/confirm-ticket")
    public ResponseEntity<Map<String, Object>> confirmTicket(
            @Valid @RequestBody ClientConfirmTicketRequest request,
            Authentication authentication) {
        String clientUsername = authentication.getName();
        ProcedureDocument procedure = aiClientAssistantService.confirmTicket(request.getPolicyId(), clientUsername);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "procedureId", procedure.getId(),
                "policyName", procedure.getPolicyName(),
                "status", procedure.getStatus()
        ));
    }
}
