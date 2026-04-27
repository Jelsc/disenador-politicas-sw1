package com.tuapp.backend.policies.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyInvitation {
    private String username;
    private String invitedBy;
    private String status; // PENDING, ACCEPTED, REJECTED
    private LocalDateTime invitedAt;
    private LocalDateTime respondedAt;
}
