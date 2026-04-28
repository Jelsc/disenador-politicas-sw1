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

    private List<String> departmentIds; // References to Departments

    private String name; // Full name, used for CLIENT role

    private String fcmToken; // Firebase Cloud Messaging token for mobile push notifications

    private boolean active;

    // Constructors
    public User() {
        this.departmentIds = List.of();
        this.active = true;
    }

    public User(String username, String email, String password, List<Role> roles, List<String> departmentIds) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.roles = roles;
        this.departmentIds = departmentIds;
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

    public String getFcmToken() {
        return fcmToken;
    }

    public void setFcmToken(String fcmToken) {
        this.fcmToken = fcmToken;
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
                ", departmentIds=" + departmentIds +
                ", active=" + active +
                '}';
    }
}
