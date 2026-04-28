import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/client_notification.dart';
import '../models/procedure_ticket.dart';
import '../services/api_service.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';
import 'procedure_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final ApiService _api = ApiService();

  List<ProcedureTicket> _procedures = [];
  List<ClientNotification> _notifications = [];
  bool _isLoading = true;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _setupNotifications();
    _loadDashboard();
  }

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  Future<void> _setupNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (response) {
        if (response.payload == null) return;
        _handleNotificationPayload(response.payload!);
      },
    );

    final token = await _token();
    if (token != null) {
      final fcmToken = await FirebaseMessaging.instance.getToken();
      if (fcmToken != null) await _api.updateFcmToken(token, fcmToken);
    }

    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      _showForegroundNotification(message);
      _loadDashboard(showSpinner: false);
    });

    FirebaseMessaging.onMessageOpenedApp.listen(_openFromRemoteMessage);
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) _openFromRemoteMessage(initialMessage);
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'tramites_channel',
          'Actualizaciones de Trámites',
          importance: Importance.max,
          priority: Priority.high,
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  void _openFromRemoteMessage(RemoteMessage message) {
    _openProcedureFromData(message.data);
  }

  void _handleNotificationPayload(String payload) {
    try {
      _openProcedureFromData(Map<String, dynamic>.from(jsonDecode(payload)));
    } catch (_) {
      // Payload inválido: no rompemos la app por una notificación vieja.
    }
  }

  Future<void> _openProcedureFromData(Map<String, dynamic> data) async {
    final procedureId = data['procedureId']?.toString();
    if (procedureId == null || procedureId.isEmpty) return;
    await _openProcedure(
      procedureId,
      taskId: data['taskId']?.toString(),
      fieldId: data['fieldId']?.toString(),
    );
  }

  Future<void> _loadDashboard({bool showSpinner = true}) async {
    if (showSpinner && mounted) setState(() => _isLoading = true);

    final token = await _token();
    if (token == null) {
      _logout();
      return;
    }

    final results = await Future.wait([
      _api.getMyProcedures(token),
      _api.getMyNotifications(token),
      _api.getUnreadNotificationCount(token),
    ]);

    if (!mounted) return;
    setState(() {
      _procedures = results[0] as List<ProcedureTicket>;
      _notifications = results[1] as List<ClientNotification>;
      _unreadCount = results[2] as int;
      _isLoading = false;
    });
  }

  Future<void> _openProcedure(
    String procedureId, {
    String? taskId,
    String? fieldId,
  }) async {
    var procedure = _findProcedure(procedureId);
    if (procedure == null) {
      await _loadDashboard(showSpinner: false);
      procedure = _findProcedure(procedureId);
    }
    if (!mounted || procedure == null) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ProcedureDetailScreen(
          procedure: procedure!,
          initialTaskId: taskId,
          initialFieldId: fieldId,
        ),
      ),
    );
    _loadDashboard(showSpinner: false);
  }

  ProcedureTicket? _findProcedure(String procedureId) {
    for (final procedure in _procedures) {
      if (procedure.id == procedureId) return procedure;
    }
    return null;
  }

  Future<void> _openNotifications() async {
    final token = await _token();
    if (token == null || !mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NotificationsScreen(
          notifications: _notifications,
          onNotificationTap: (notification) async {
            await _api.markNotificationRead(token, notification.id);
            if (notification.procedureId != null) {
              await _openProcedure(
                notification.procedureId!,
                taskId: notification.taskId,
                fieldId: notification.fieldId,
              );
            }
          },
        ),
      ),
    );
    _loadDashboard(showSpinner: false);
  }

  void _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F1E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
        elevation: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Mis trámites', style: TextStyle(fontWeight: FontWeight.w800)),
            Text('Seguimiento ciudadano', style: TextStyle(fontSize: 12)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Notificaciones',
            onPressed: _openNotifications,
            icon: Badge(
              isLabelVisible: _unreadCount > 0,
              label: Text(_unreadCount > 99 ? '99+' : '$_unreadCount'),
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  _buildNotificationLedger(),
                  const SizedBox(height: 16),
                  if (_procedures.isEmpty) _buildEmptyState(),
                  ..._procedures.map(_buildProcedureCard),
                ],
              ),
      ),
    );
  }

  Widget _buildNotificationLedger() {
    final latest = _notifications.take(2).toList();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF6),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE3D8C5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.mark_email_unread_outlined,
                color: Color(0xFF7C4A20),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Bandeja de avisos',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              TextButton(
                onPressed: _openNotifications,
                child: const Text('Ver todo'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (latest.isEmpty)
            const Text('Todavía no llegaron notificaciones de tus trámites.')
          else
            ...latest.map(
              (notification) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: _notificationIcon(notification.type),
                title: Text(
                  notification.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  notification.body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                onTap: () => _openNotifications(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildProcedureCard(ProcedureTicket procedure) {
    final hasSignature = procedure.pendingSignatureRequests.isNotEmpty;
    return Card(
      elevation: 0,
      color: const Color(0xFFFFFCF6),
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: const BorderSide(color: Color(0xFFE3D8C5)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => _openProcedure(procedure.id),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      procedure.policyName,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  _statusPill(procedure.status),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: procedure.progressPercentage / 100,
                  minHeight: 9,
                  backgroundColor: const Color(0xFFE9DEC9),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    hasSignature
                        ? const Color(0xFFB45309)
                        : const Color(0xFF6D5A3D),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text('${procedure.progressPercentage}% completado'),
              if (procedure.currentTasks.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Ahora: ${procedure.currentTasks.join(', ')}'),
              ],
              if (hasSignature) ...[
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () => _openProcedure(
                    procedure.id,
                    taskId: procedure.pendingSignatureRequests.first.taskId,
                    fieldId: procedure.pendingSignatureRequests.first.fieldId,
                  ),
                  icon: const Icon(Icons.draw_outlined),
                  label: const Text('Firmar pendiente'),
                ),
              ],
              const SizedBox(height: 8),
              Text(
                'Creado: ${DateFormat('dd/MM/yyyy HH:mm').format(procedure.createdAt)}',
                style: const TextStyle(color: Color(0xFF7B7063), fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF6),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE3D8C5)),
      ),
      child: const Column(
        children: [
          Icon(Icons.inventory_2_outlined, size: 54, color: Color(0xFF9A8A73)),
          SizedBox(height: 12),
          Text(
            'No tenés trámites activos',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          SizedBox(height: 6),
          Text(
            'Cuando un funcionario registre un trámite con tu CI, va a aparecer acá.',
          ),
        ],
      ),
    );
  }

  Widget _statusPill(String status) {
    final completed = status == 'COMPLETED';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: completed ? const Color(0xFFE7F5E8) : const Color(0xFFFFF1D6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        completed ? 'Completado' : 'En curso',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: completed ? const Color(0xFF166534) : const Color(0xFF92400E),
        ),
      ),
    );
  }

  Widget _notificationIcon(String type) {
    final signature = type.contains('SIGNATURE');
    return CircleAvatar(
      backgroundColor: signature
          ? const Color(0xFFFFE8C7)
          : const Color(0xFFEDE3D1),
      foregroundColor: signature
          ? const Color(0xFF92400E)
          : const Color(0xFF5B4B35),
      child: Icon(signature ? Icons.draw_outlined : Icons.description_outlined),
    );
  }
}
