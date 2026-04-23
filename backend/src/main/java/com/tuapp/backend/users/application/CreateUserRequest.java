package com.tuapp.backend.users.application;

/**
 * Request DTO for creating a new user
 */
public class CreateUserRequest {
    private String username;
    private String email;
    private String password;
    private String role; // ADMIN, DESIGNER, OPERATOR
    private String departmentId;

    public CreateUserRequest() {}

    public CreateUserRequest(String username, String email, String password, String role, String departmentId) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.role = role;
        this.departmentId = departmentId;
    }

    // Getters & Setters
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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
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
}
