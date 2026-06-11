package com.tuapp.backend.ai.client;

import com.tuapp.backend.policies.application.PolicyService;
import com.tuapp.backend.policies.domain.Policy;
import com.tuapp.backend.policies.operation.CreateProcedureRequest;
import com.tuapp.backend.policies.operation.ProcedureDocument;
import com.tuapp.backend.policies.operation.ProcedureOperationService;
import com.tuapp.backend.users.domain.User;
import com.tuapp.backend.users.domain.UserRepository;
import org.springframework.stereotype.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiClientAssistantService {

    private final PolicyService policyService;
    private final ProcedureOperationService procedureOperationService;
    private final UserRepository userRepository;
    private final RestTemplate restTemplate;

    @Value("${AI_SERVICE_INTERNAL_URL:http://ai-service:8000}")
    private String aiServiceUrl;

    public AiClientAssistantService(PolicyService policyService,
                                     ProcedureOperationService procedureOperationService,
                                     UserRepository userRepository,
                                     RestTemplate aiServiceClientRestTemplate) {
        this.policyService = policyService;
        this.procedureOperationService = procedureOperationService;
        this.userRepository = userRepository;
        this.restTemplate = aiServiceClientRestTemplate;
    }

    public ClientAskResponse ask(String text, String audioBase64, String clientUsername) {
        // 1. Get client info
        User client = userRepository.findByUsername(clientUsername).orElse(null);
        String clientName = client != null ? (client.getName() != null ? client.getName() : clientUsername) : clientUsername;

        // 2. Get published policies
        List<Policy> policies = policyService.getPublishedPoliciesForExecution();
        List<Map<String, Object>> policySummaries = policies.stream()
                .map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", p.getId());
                    map.put("name", p.getName());
                    map.put("description", p.getDescription() != null ? p.getDescription() : "");
                    return map;
                })
                .toList();

        // 3. Prepare payload for AI Service
        Map<String, Object> payload = new HashMap<>();
        payload.put("text", text);
        payload.put("audioBase64", audioBase64);
        payload.put("policies", policySummaries);

        // 4. Call Python AI Service
        String endpoint = aiServiceUrl + "/client/ask";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(payload, headers);

        ClientAskResponse.SuggestedPolicy suggestedPolicy = null;
        String answer = "";
        
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, requestEntity, Map.class);
            Map<String, Object> body = response.getBody();
            if (body != null) {
                String suggestedId = (String) body.get("suggestedPolicyId");
                answer = (String) body.get("answer");
                Double confidence = body.get("confidence") instanceof Number ? ((Number) body.get("confidence")).doubleValue() : 0.0;
                
                if (suggestedId != null && !suggestedId.isEmpty()) {
                    Policy matchedPolicy = policies.stream().filter(p -> p.getId().equals(suggestedId)).findFirst().orElse(null);
                    if (matchedPolicy != null) {
                        suggestedPolicy = new ClientAskResponse.SuggestedPolicy(matchedPolicy.getId(), matchedPolicy.getName(), confidence);
                    }
                }
            }
        } catch (Exception e) {
            answer = "Hubo un error al comunicarme con el sistema de IA. ¿Podés intentar de nuevo?";
            e.printStackTrace();
        }

        // Return summaries for UI
        List<ClientAskResponse.PolicySummary> summariesForUi = policies.stream()
                .map(p -> new ClientAskResponse.PolicySummary(p.getId(), p.getName(), p.getDescription() != null ? p.getDescription() : ""))
                .toList();

        return new ClientAskResponse(answer, summariesForUi, suggestedPolicy);
    }

    public ProcedureDocument confirmTicket(String policyId, String clientUsername) {
        User client = userRepository.findByUsername(clientUsername)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));

        CreateProcedureRequest request = new CreateProcedureRequest();
        request.setPolicyId(policyId);
        request.setClientFullName(client.getName() != null ? client.getName() : clientUsername);
        request.setClientCi(clientUsername);
        request.setClientEmail(client.getEmail());
        request.setValues(Map.of("origen", "asistente-ia-cliente"));

        return procedureOperationService.createProcedure(request, clientUsername);
    }

}
