# Proposal: Phase 3 - Policies Module & Frontend RBAC

## Intent
Implement the foundational backend CRUD operations for the Policies module and build its frontend interface. Crucially, introduce a strict Role-Based Access Control (RBAC) mechanism in the frontend sidebar so that users are only exposed to routes they have explicit permissions to access (e.g., ADMIN sees Users, DESIGNER sees Policies). The frontend must adopt a custom design system following the `interface-design` skill principles (Intent-first, Subtle Layering, Typography hierarchy, avoiding generic templates) to ensure a high-quality, tailored user experience.

## Proposed Solution
### Backend (Spring Boot / Java 17)
- Apply Clean/Hexagonal Architecture principles to implement the Policies module.
- **Domain**: Define the `Policy` entity and related value objects.
- **Repository**: Interface for data access (with Spring Data JPA implementation).
- **Use Cases**: Create, Read, Update, Delete (CRUD) operations for Policies.
- **Controller**: REST API endpoints exposing the use cases, secured via Spring Security (checking authorities matching the frontend roles).

### Frontend (Angular 21)
- **RBAC Sidebar**: Implement a dynamic sidebar component driven by the authenticated user's claims/roles. Routes will be guarded via Angular Router guards (`CanActivateFn`), redirecting unauthorized access.
- **UI/UX Design**: Leverage the `interface-design` skill:
  - **Intent-first**: Design the Policies UI around user goals (e.g., clear, distraction-free calls to action for creating/editing policies).
  - **Subtle Layering & Typography**: Use distinct typographical hierarchies and subtle surface layering to separate navigation, data tables, and forms, discarding generic component library templates in favor of a bespoke, crafted look.
- **Integration**: Connect the Policies Angular views to the new Spring Boot REST endpoints using standard Angular services and Signals.

## Scope

### In Scope
- Domain, Repository, Use Cases, and Controller layers for Policies CRUD in Spring Boot.
- Angular 21 dynamic sidebar component with role-based route filtering.
- Angular Router guards for strict client-side access control (ADMIN, DESIGNER roles).
- Custom-designed Policies UI (List, Create, Edit, View) applying `interface-design` principles.
- End-to-end wiring of the Policies frontend module to the backend APIs.

### Out of Scope
- Complex policy rule engines or execution logic (only managing the policy entity/CRUD for now).
- Core Authentication mechanisms (e.g., login screens, JWT token generation) – assuming standard auth token is already present or handled elsewhere.
- Backend dynamic permission resolution beyond standard `@PreAuthorize` role checks.
- Deep audit logging or version history of policy changes.