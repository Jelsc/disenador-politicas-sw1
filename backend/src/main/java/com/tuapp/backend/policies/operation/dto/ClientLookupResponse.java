package com.tuapp.backend.policies.operation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientLookupResponse {
    private ClientLookupStatus status;
    private String message;
    private ClientLookupUserResponse client;
    private ClientLookupUserResponse clientByCi;
    private ClientLookupUserResponse clientByEmail;
}
