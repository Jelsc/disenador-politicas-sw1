import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/procedure_ticket.dart';

class ApiService {
  // En debug asume local emulador, en release asume producción
  static const String baseUrl = kReleaseMode
      ? 'https://api-primerpacialsw.duckdns.org/api'
      : 'http://10.0.2.2:8080/api';

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
}
