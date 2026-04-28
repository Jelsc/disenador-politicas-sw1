package com.tuapp.backend.users.application;

import java.util.List;

/**
 * Response DTO for user operations
 */
public class UserResponse {
    private String id;
    private String username;
    private String email;
    private String role;
    private List<String> departmentIds;
    private boolean active;
    private String name;

    public UserResponse() {}

    public UserResponse(String id, String username, String email, String role, List<String> departmentIds, boolean active, String name) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.role = role;
        this.departmentIds = departmentIds;
        this.active = active;
        this.name = name;
    }

    // Getters & Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public List<String> getDepartmentIds() {
        return departmentIds;
    }

    public void setDepartmentIds(List<String> departmentIds) {
        this.departmentIds = departmentIds;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
