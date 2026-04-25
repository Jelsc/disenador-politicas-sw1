package com.tuapp.backend.policies.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "policies")
public class Policy {
    @Id
    private String id;
    private String name;
    private String description;
    private String rules; // JSON representacion del workflow (v1 MVP)
    private PolicyStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
