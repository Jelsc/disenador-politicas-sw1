class ClientNotification {
  final String id;
  final String title;
  final String body;
  final String type;
  final String? procedureId;
  final String? taskId;
  final String? fieldId;
  final bool read;
  final DateTime createdAt;

  ClientNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    this.procedureId,
    this.taskId,
    this.fieldId,
    required this.read,
    required this.createdAt,
  });

  factory ClientNotification.fromJson(Map<String, dynamic> json) {
    return ClientNotification(
      id: json['id'] ?? '',
      title: json['title'] ?? 'Actualización de trámite',
      body: json['body'] ?? '',
      type: json['type'] ?? 'PROCEDURE_UPDATE',
      procedureId: json['procedureId'],
      taskId: json['taskId'],
      fieldId: json['fieldId'],
      read: json['read'] == true,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}
