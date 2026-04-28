import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/client_notification.dart';
import '../models/procedure_ticket.dart';

class ApiService {
  // Elegí MANUALMENTE la URL que quieras usar.
  // LOCAL Android emulator:
  // static const String baseUrl = 'http://10.0.2.2:8080/api';

  // NUBE / PRODUCCIÓN:
  static const String baseUrl = 'https://api-primerpacialsw.duckdns.org/api';

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
}
