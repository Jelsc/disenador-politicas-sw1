class ProcedureTicket {
  final String id;
  final String policyId;
  final String policyName;
  final String status;
  final String? clientName;
  final String? clientCi;
  final int progressPercentage;
  final List<String> currentDepartments;
  final List<String> currentTasks;
  final String? finalObservation;
  final List<SignatureRequest> pendingSignatureRequests;
  final List<ProcedureClientTask> pendingClientTasks;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final DateTime? completedAt;

  ProcedureTicket({
    required this.id,
    required this.policyId,
    required this.policyName,
    required this.status,
    this.clientName,
    this.clientCi,
    required this.progressPercentage,
    required this.currentDepartments,
    required this.currentTasks,
    this.finalObservation,
    required this.pendingSignatureRequests,
    required this.pendingClientTasks,
    required this.createdAt,
    this.updatedAt,
    this.completedAt,
  });

  factory ProcedureTicket.fromJson(Map<String, dynamic> json) {
    return ProcedureTicket(
      id: json['id'] ?? '',
      policyId: json['policyId'] ?? '',
      policyName: json['policyName'] ?? '',
      status: json['status'] ?? 'OPEN',
      clientName: json['clientName'],
      clientCi: json['clientCi'],
      progressPercentage: json['progressPercentage'] ?? 0,
      currentDepartments: List<String>.from(json['currentDepartments'] ?? []),
      currentTasks: List<String>.from(json['currentTasks'] ?? []),
      finalObservation: json['finalObservation'],
      pendingSignatureRequests:
          (json['pendingSignatureRequests'] as List<dynamic>? ?? [])
              .map(
                (item) =>
                    SignatureRequest.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList(),
      pendingClientTasks:
          (json['pendingClientTasks'] as List<dynamic>? ?? [])
              .map(
                (item) =>
                    ProcedureClientTask.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList(),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : null,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : null,
    );
  }
}

class ProcedureClientTask {
  final String id;
  final String label;
  final List<ClientTaskField> fields;

  ProcedureClientTask({
    required this.id,
    required this.label,
    required this.fields,
  });

  factory ProcedureClientTask.fromJson(Map<String, dynamic> json) {
    return ProcedureClientTask(
      id: json['id'] ?? '',
      label: json['nodeLabel'] ?? 'Tarea pendiente',
      fields: (json['formFields'] as List<dynamic>? ?? [])
          .map((item) => ClientTaskField.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
    );
  }
}

class ClientTaskField {
  final String id;
  final String type;
  final String label;
  final bool required;
  final String? placeholder;

  ClientTaskField({
    required this.id,
    required this.type,
    required this.label,
    required this.required,
    this.placeholder,
  });

  factory ClientTaskField.fromJson(Map<String, dynamic> json) {
    return ClientTaskField(
      id: json['id'] ?? '',
      type: json['type'] ?? 'TEXT',
      label: json['label'] ?? '',
      required: json['required'] ?? false,
      placeholder: json['placeholder'],
    );
  }
}

class ProcedureRepositoryDocument {
  final String id;
  final String documentId;
  final int version;
  final String originalFileName;
  final String? contentType;
  final int size;
  final String? createdBy;
  final String? traceAction;
  final String? traceNote;
  final DateTime? createdAt;
  final String? downloadUri;

  ProcedureRepositoryDocument({
    required this.id,
    required this.documentId,
    required this.version,
    required this.originalFileName,
    this.contentType,
    required this.size,
    this.createdBy,
    this.traceAction,
    this.traceNote,
    this.createdAt,
    this.downloadUri,
  });

  factory ProcedureRepositoryDocument.fromJson(Map<String, dynamic> json) {
    return ProcedureRepositoryDocument(
      id: json['id'] ?? '',
      documentId: json['documentId'] ?? '',
      version: json['version'] ?? 1,
      originalFileName: json['originalFileName'] ?? 'Documento',
      contentType: json['contentType'],
      size: json['size'] ?? 0,
      createdBy: json['createdBy'],
      traceAction: json['traceAction'],
      traceNote: json['traceNote'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      downloadUri: json['downloadUri'],
    );
  }
}

class SignatureRequest {
  final String taskId;
  final String fieldId;
  final String label;
  final String message;
  final String taskLabel;

  SignatureRequest({
    required this.taskId,
    required this.fieldId,
    required this.label,
    required this.message,
    required this.taskLabel,
  });

  factory SignatureRequest.fromJson(Map<String, dynamic> json) {
    return SignatureRequest(
      taskId: json['taskId'] ?? '',
      fieldId: json['fieldId'] ?? '',
      label: json['label'] ?? 'Firma del cliente',
      message: json['message'] ?? 'Se requiere tu firma digital.',
      taskLabel: json['taskLabel'] ?? 'Etapa del trámite',
    );
  }
}
