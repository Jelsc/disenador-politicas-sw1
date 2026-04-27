package com.tuapp.backend.policies.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Policy {
    private String id;
    private String name;
    private String description;
    private String version;
    private String rules;
    private String createdBy;
    private List<String> editors;
    private List<PolicyInvitation> invitations;
    private String currentPublishedVersionId;
    private String status; // BORRADOR, EN_REVISION, PUBLICADA, ARCHIVADA
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
