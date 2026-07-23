package com.tuapp.backend.policies.operation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientLookupUserResponse {
    private String id;
    private String username;
    private String email;
    private String name;
}
