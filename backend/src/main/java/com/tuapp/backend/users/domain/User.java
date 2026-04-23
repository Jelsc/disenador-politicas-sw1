package com.tuapp.backend.users.domain;

import com.tuapp.backend.shared.domain.AuditableEntity;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

/**
 * User entity: represents a system user with authentication and role-based access.
 * Auditable: tracks who created/updated and when.
 */
@Document(collection = "users")
public class User extends AuditableEntity {

    @Indexed(unique = true)
    private String username;

    @Indexed(unique = true)
    private String email;

    private String password; // BCrypt hashed

    private List<Role> roles;

    private String departmentId; // Reference to Department

    private boolean active;

    // Constructors
    public User() {
        this.active = true;
    }

    public User(String username, String email, String password, List<Role> roles, String departmentId) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.roles = roles;
        this.departmentId = departmentId;
        this.active = true;
    }

    // Getters
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

    public List<Role> getRoles() {
        return roles;
    }

    public void setRoles(List<Role> roles) {
        this.roles = roles;
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

    @Override
    public String toString() {
        return "User{" +
                "id='" + getId() + '\'' +
                ", username='" + username + '\'' +
                ", email='" + email + '\'' +
                ", roles=" + roles +
                ", departmentId='" + departmentId + '\'' +
                ", active=" + active +
                '}';
    }
}
