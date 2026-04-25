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
public class Policy {
    private String id;
    private String name;
    private String description;
    private String status; // ACTIVE, DRAFT, ARCHIVED
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
