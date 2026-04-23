package com.tuapp.backend.users.domain;

/**
 * Role enum: defines user roles in the system.
 * Each role has different permissions within the workflow management.
 */
public enum Role {
    ADMIN,      // Can manage users, policies, audit
    DESIGNER,   // Can create policies and workflows
    OPERATOR    // Can only execute workflows
}
