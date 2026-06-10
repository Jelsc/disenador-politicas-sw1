import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../models/client_notification.dart';
import '../models/procedure_ticket.dart';

class ApiService {
  // Elegí MANUALMENTE la URL que quieras usar.
  // LOCAL Android emulator:
  static const String baseUrl = 'http://10.0.2.2:8080/api';

  // NUBE / PRODUCCIÓN:
  //static const String baseUrl = 'https://api-primerpacialsw.duckdns.org/api';

  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'username': username, 'password': password}),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {'success': true, 'token': data['token'], 'role': data['role']};
      } else {
        return {'success': false, 'message': 'Credenciales inválidas'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  Future<bool> updateFcmToken(String token, String fcmToken) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/users/me/fcm-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({'token': fcmToken}),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<List<ProcedureTicket>> getMyProcedures(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/operations/procedures/mine'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((p) => ProcedureTicket.fromJson(p)).toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<List<ClientNotification>> getMyNotifications(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/operations/notifications/mine'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((n) => ClientNotification.fromJson(n)).toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<int> getUnreadNotificationCount(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/operations/notifications/unread-count'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['count'] ?? 0;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  Future<void> markNotificationRead(String token, String notificationId) async {
    try {
      await http.post(
        Uri.parse('$baseUrl/operations/notifications/$notificationId/read'),
        headers: {'Authorization': 'Bearer $token'},
      );
    } catch (e) {
      // No bloquear navegación por un fallo de lectura.
    }
  }

  Future<Map<String, dynamic>> submitAiVoiceIntake({
    String? text,
    String? audioBase64,
    String? policyName,
    Map<String, dynamic>? context,
  }) async {
    return _postAiJson('/voice/intake', {
      if (text != null && text.trim().isNotEmpty) 'text': text.trim(),
      if (audioBase64 != null && audioBase64.isNotEmpty)
        'audioBase64': audioBase64,
      if (policyName != null && policyName.isNotEmpty) 'policyName': policyName,
      if (context != null && context.isNotEmpty) 'context': context,
    });
  }

  Future<Map<String, dynamic>> requestAiAnalystInsights({
    required String requestText,
    String? policyName,
  }) async {
    return _postAiJson('/analyst/insights', {
      'requestText': requestText,
      if (policyName != null && policyName.isNotEmpty) 'policyName': policyName,
    });
  }

  Future<Map<String, dynamic>> requestAiReportDraft({
    String? text,
    String? transcript,
    String? policyName,
    Map<String, dynamic>? context,
  }) async {
    return _postAiJson('/reports/draft', {
      if (text != null && text.trim().isNotEmpty) 'text': text.trim(),
      if (transcript != null && transcript.trim().isNotEmpty)
        'transcript': transcript.trim(),
      if (policyName != null && policyName.isNotEmpty) 'policyName': policyName,
      if (context != null && context.isNotEmpty) 'context': context,
    });
  }

  Future<Map<String, dynamic>> requestAiFormAssist({
    String? text,
    String? audioBase64,
    String? policyName,
    Map<String, dynamic>? context,
    List<Map<String, dynamic>>? formFields,
  }) async {
    return _postAiJson('/form/assist', {
      if (text != null && text.trim().isNotEmpty) 'text': text.trim(),
      if (audioBase64 != null && audioBase64.isNotEmpty)
        'audioBase64': audioBase64,
      if (policyName != null && policyName.isNotEmpty) 'policyName': policyName,
      if (context != null && context.isNotEmpty) 'context': context,
      if (formFields != null && formFields.isNotEmpty) 'formFields': formFields,
    });
  }

  Future<Map<String, dynamic>> _postAiJson(
    String path,
    Map<String, dynamic> payload,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl$path'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(payload),
      );

      final decoded = response.body.isNotEmpty
          ? json.decode(response.body)
          : <String, dynamic>{};
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return decoded is Map<String, dynamic>
            ? decoded
            : <String, dynamic>{'success': true, 'data': decoded};
      }

      return {
        'success': false,
        'message': decoded is Map && decoded['message'] != null
            ? decoded['message'].toString()
            : 'Error de IA (${response.statusCode})',
      };
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  Future<bool> submitClientSignature({
    required String token,
    required String procedureId,
    required String taskId,
    required String fieldId,
    required String imageBase64,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/operations/procedures/$procedureId/signature'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'taskId': taskId,
          'fieldId': fieldId,
          'imageBase64': imageBase64,
        }),
      );
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (e) {
      return false;
    }
  }

  Future<List<ProcedureRepositoryDocument>> getProcedureDocuments(
    String token,
    String procedureId,
  ) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/procedures/$procedureId/documents'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data
            .map(
              (item) => ProcedureRepositoryDocument.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> uploadProcedureDocument({
    required String token,
    required String procedureId,
    required String fileName,
    required Uint8List bytes,
    String? documentId,
  }) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/procedures/$procedureId/documents'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      if (documentId != null && documentId.isNotEmpty) {
        request.fields['documentId'] = documentId;
      }
      request.files.add(
        http.MultipartFile.fromBytes('file', bytes, filename: fileName),
      );

      final response = await request.send();
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (e) {
      return false;
    }
  }
}
