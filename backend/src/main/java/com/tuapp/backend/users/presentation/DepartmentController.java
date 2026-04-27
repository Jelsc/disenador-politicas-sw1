package com.tuapp.backend.users.presentation;

import com.tuapp.backend.users.application.DepartmentResponse;
import com.tuapp.backend.users.application.SaveDepartmentRequest;
import com.tuapp.backend.users.domain.Department;
import com.tuapp.backend.users.domain.DepartmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/departments")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:80"})
public class DepartmentController {

    private final DepartmentRepository departmentRepository;

    public DepartmentController(DepartmentRepository departmentRepository) {
        this.departmentRepository = departmentRepository;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('DESIGNER')")
    public ResponseEntity<List<DepartmentResponse>> listDepartments() {
        Iterable<Department> departments = departmentRepository.findAll();
        List<DepartmentResponse> response = new ArrayList<>();

        departments.forEach(department -> response.add(toResponse(department)));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getDepartment(@PathVariable String id) {
        return departmentRepository.findById(id)
                .<ResponseEntity<?>>map(department -> ResponseEntity.ok(toResponse(department)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ErrorResponse("Not Found", "Department not found")));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createDepartment(@RequestBody SaveDepartmentRequest request) {
        try {
            Department department = validateAndMap(null, request);
            Department savedDepartment = departmentRepository.save(department);
            return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(savedDepartment));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("Bad Request", exception.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDepartment(@PathVariable String id, @RequestBody SaveDepartmentRequest request) {
        try {
            Department existingDepartment = departmentRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Department not found"));

            Department department = validateAndMap(existingDepartment, request);
            Department savedDepartment = departmentRepository.save(department);
            return ResponseEntity.ok(toResponse(savedDepartment));
        } catch (IllegalArgumentException exception) {
            HttpStatus status = "Department not found".equals(exception.getMessage())
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status)
                    .body(new ErrorResponse(status == HttpStatus.NOT_FOUND ? "Not Found" : "Bad Request", exception.getMessage()));
        }
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDepartmentStatus(@PathVariable String id, @RequestParam boolean active) {
        return departmentRepository.findById(id)
                .<ResponseEntity<?>>map(department -> {
                    department.setActive(active);
                    Department savedDepartment = departmentRepository.save(department);
                    return ResponseEntity.ok(toResponse(savedDepartment));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ErrorResponse("Not Found", "Department not found")));
    }

    private Department validateAndMap(Department department, SaveDepartmentRequest request) {
        String normalizedName = request.getName() == null ? null : request.getName().trim();
        String normalizedDescription = request.getDescription() == null ? "" : request.getDescription().trim();

        if (normalizedName == null || normalizedName.isEmpty()) {
            throw new IllegalArgumentException("Department name is required");
        }

        departmentRepository.findByName(normalizedName)
                .filter(existing -> department == null || !existing.getId().equals(department.getId()))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Department name already exists");
                });

        Department target = department == null ? new Department() : department;
        target.setName(normalizedName);
        target.setDescription(normalizedDescription);

        if (department == null) {
            target.setActive(true);
        }

        return target;
    }

    private DepartmentResponse toResponse(Department department) {
        return new DepartmentResponse(
                department.getId(),
                department.getName(),
                department.getDescription(),
                department.isActive()
        );
    }

    static class ErrorResponse {
        public String error;
        public String message;

        ErrorResponse(String error, String message) {
            this.error = error;
            this.message = message;
        }

        public String getError() {
            return error;
        }

        public String getMessage() {
            return message;
        }
    }
}
