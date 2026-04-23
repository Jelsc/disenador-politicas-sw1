package com.tuapp.backend.users.application;

/**
 * Response DTO for user operations
 */
public class UserResponse {
    private String id;
    private String username;
    private String email;
    private String role;
    private String departmentId;
    private boolean active;

    public UserResponse() {}

    public UserResponse(String id, String username, String email, String role, String departmentId, boolean active) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.role = role;
        this.departmentId = departmentId;
        this.active = active;
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

    public String getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(String departmentId) {
        this.departmentId = departmentId;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
