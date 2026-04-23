package com.tuapp.backend.shared.domain;

import java.time.LocalDateTime;

/**
 * Auditable entity that extends Entity with audit fields.
 * Tracks who created and updated each entity.
 */
public abstract class AuditableEntity extends Entity {

    protected String createdBy;
    protected String updatedBy;

    protected AuditableEntity() {
        super();
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }
}
