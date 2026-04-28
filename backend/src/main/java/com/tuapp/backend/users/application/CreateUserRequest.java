package com.tuapp.backend.users.application;

import java.util.List;

/**
 * Request DTO for creating a new user
 */
public class CreateUserRequest {
    private String username;
    private String email;
    private String password;
    private String role; // ADMIN, DESIGNER, OPERATOR, CLIENT
    private List<String> departmentIds;
    private String name;

    public CreateUserRequest() {}

    public CreateUserRequest(String username, String email, String password, String role, List<String> departmentIds) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.role = role;
        this.departmentIds = departmentIds;
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

    public List<String> getDepartmentIds() {
        return departmentIds;
    }

    public void setDepartmentIds(List<String> departmentIds) {
        this.departmentIds = departmentIds;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
