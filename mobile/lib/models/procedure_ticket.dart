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