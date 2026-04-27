package com.tuapp.backend.policies.application;

import java.time.LocalDateTime;

public class PolicyInvitationNotificationResponse {
    private String policyId;
    private String policyName;
    private String invitedBy;
    private LocalDateTime invitedAt;

    public PolicyInvitationNotificationResponse() {
    }

    public PolicyInvitationNotificationResponse(String policyId, String policyName, String invitedBy, LocalDateTime invitedAt) {
        this.policyId = policyId;
        this.policyName = policyName;
        this.invitedBy = invitedBy;
        this.invitedAt = invitedAt;
    }

    public String getPolicyId() {
        return policyId;
    }

    public void setPolicyId(String policyId) {
        this.policyId = policyId;
    }

    public String getPolicyName() {
        return policyName;
    }

    public void setPolicyName(String policyName) {
        this.policyName = policyName;
    }

    public String getInvitedBy() {
        return invitedBy;
    }

    public void setInvitedBy(String invitedBy) {
        this.invitedBy = invitedBy;
    }

    public LocalDateTime getInvitedAt() {
        return invitedAt;
    }

    public void setInvitedAt(LocalDateTime invitedAt) {
        this.invitedAt = invitedAt;
    }
}
