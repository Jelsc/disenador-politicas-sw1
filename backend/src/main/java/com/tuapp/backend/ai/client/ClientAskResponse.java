package com.tuapp.backend.ai.client;

import java.util.List;

public class ClientAskResponse {
    private String answer;
    private List<PolicySummary> policies;
    private SuggestedPolicy suggestedPolicy;

    public ClientAskResponse() {}

    public ClientAskResponse(String answer, List<PolicySummary> policies, SuggestedPolicy suggestedPolicy) {
        this.answer = answer;
        this.policies = policies;
        this.suggestedPolicy = suggestedPolicy;
    }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public List<PolicySummary> getPolicies() { return policies; }
    public void setPolicies(List<PolicySummary> policies) { this.policies = policies; }

    public SuggestedPolicy getSuggestedPolicy() { return suggestedPolicy; }
    public void setSuggestedPolicy(SuggestedPolicy suggestedPolicy) { this.suggestedPolicy = suggestedPolicy; }

    public static class PolicySummary {
        private String id;
        private String name;
        private String description;

        public PolicySummary() {}

        public PolicySummary(String id, String name, String description) {
            this.id = id;
            this.name = name;
            this.description = description;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    public static class SuggestedPolicy {
        private String policyId;
        private String policyName;
        private double confidence;

        public SuggestedPolicy() {}

        public SuggestedPolicy(String policyId, String policyName, double confidence) {
            this.policyId = policyId;
            this.policyName = policyName;
            this.confidence = confidence;
        }

        public String getPolicyId() { return policyId; }
        public void setPolicyId(String policyId) { this.policyId = policyId; }

        public String getPolicyName() { return policyName; }
        public void setPolicyName(String policyName) { this.policyName = policyName; }

        public double getConfidence() { return confidence; }
        public void setConfidence(double confidence) { this.confidence = confidence; }
    }
}
