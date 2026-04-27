package com.tuapp.backend.policies.operation;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;

public interface ProcedureTaskMongoRepository extends MongoRepository<ProcedureTaskDocument, String> {
    List<ProcedureTaskDocument> findByDepartmentIdInAndStatusOrderByCreatedAtAsc(Collection<String> departmentIds, String status);
    List<ProcedureTaskDocument> findByAssignedToAndStatusOrderByAssignedAtAsc(String assignedTo, String status);
    List<ProcedureTaskDocument> findByStatusOrderByCompletedAtDesc(String status);
    List<ProcedureTaskDocument> findByProcedureIdOrderByCreatedAtAsc(String procedureId);
    long countByDepartmentIdAndStatus(String departmentId, String status);
    boolean existsByProcedureIdAndNodeId(String procedureId, String nodeId);
}
