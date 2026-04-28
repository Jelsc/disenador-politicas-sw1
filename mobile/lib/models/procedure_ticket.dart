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
