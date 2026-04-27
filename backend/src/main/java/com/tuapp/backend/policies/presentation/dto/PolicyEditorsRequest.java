package com.tuapp.backend.policies.presentation.dto;

import java.util.List;

public class PolicyEditorsRequest {
    private List<String> editors;

    public List<String> getEditors() {
        return editors;
    }

    public void setEditors(List<String> editors) {
        this.editors = editors;
    }
}
