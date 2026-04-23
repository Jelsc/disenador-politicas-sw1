package com.tuapp.backend.users.domain;

import com.tuapp.backend.shared.domain.Entity;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Department entity: represents an organizational department.
 * Users are assigned to departments for access control.
 */
@Document(collection = "departments")
public class Department extends Entity {

    @Indexed(unique = true)
    private String name;

    private String description;

    private boolean active;

    // Constructors
    public Department() {
        this.active = true;
    }

    public Department(String name, String description) {
        this.name = name;
        this.description = description;
        this.active = true;
    }

    // Getters & Setters
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    @Override
    public String toString() {
        return "Department{" +
                "id='" + getId() + '\'' +
                ", name='" + name + '\'' +
                ", description='" + description + '\'' +
                ", active=" + active +
                '}';
    }
}
