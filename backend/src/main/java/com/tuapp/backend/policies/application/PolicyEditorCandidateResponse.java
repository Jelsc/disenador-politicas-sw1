package com.tuapp.backend.policies.application;

public class PolicyEditorCandidateResponse {
    private String id;
    private String username;
    private String role;

    public PolicyEditorCandidateResponse() {
    }

    public PolicyEditorCandidateResponse(String id, String username, String role) {
        this.id = id;
        this.username = username;
        this.role = role;
    }

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

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
