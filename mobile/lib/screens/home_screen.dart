import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../services/api_service.dart';
import '../models/procedure_ticket.dart';
import 'login_screen.dart';
import 'procedure_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<ProcedureTicket> _procedures = [];
  bool _isLoading = true;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  @override
  void initState() {
    super.initState();
    _setupNotifications();
    _loadProcedures();
  }

  Future<void> _setupNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);
    await _localNotifications.initialize(initSettings);

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    
    if (token != null) {
      String? fcmToken = await FirebaseMessaging.instance.getToken();
      if (fcmToken != null) {
        await ApiService().updateFcmToken(token, fcmToken);
      }
    }

    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (message.notification != null) {
        _localNotifications.show(
          message.hashCode,
          message.notification!.title,
          message.notification!.body,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'tramites_channel',
              'Actualizaciones de Trámites',
              importance: Importance.max,
              priority: Priority.high,
            ),
          ),
        );
        _loadProcedures(); // Refrescar lista al recibir notificación
      }
    });
  }

  Future<void> _loadProcedures() async {
    setState(() => _isLoading = true);
    
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    if (token == null) {
      _logout();
      return;
    }

    final procedures = await ApiService().getMyProcedures(token);

    setState(() {
      _procedures = procedures;
      _isLoading = false;
    });
  }

  void _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'OPEN':
        return 'En Progreso';
      case 'COMPLETED':
        return 'Completado';
      default:
        return status;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'OPEN':
        return Colors.orange;
      case 'COMPLETED':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('Mis Trámites'),
        backgroundColor: const Color(0xFF7c3aed),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadProcedures,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _procedures.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.inbox,
                          size: 64,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No tenés trámites',
                          style: TextStyle(
                            fontSize: 18,
                            color: Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Acá vas a ver el progreso de tus trámites',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _procedures.length,
                    itemBuilder: (context, index) {
                      final proc = _procedures[index];
                      return InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ProcedureDetailScreen(procedure: proc),
                            ),
                          );
                        },
                        child: Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      proc.policyName,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: _getStatusColor(proc.status)
                                          .withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      _getStatusLabel(proc.status),
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: _getStatusColor(proc.status),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (proc.clientName != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Cliente: ${proc.clientName} (CI: ${proc.clientCi})',
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              if (proc.progressPercentage > 0) ...[
                                Row(
                                  children: [
                                    Expanded(
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(10),
                                        child: LinearProgressIndicator(
                                          value: proc.progressPercentage / 100,
                                          backgroundColor: Colors.grey[200],
                                          valueColor: AlwaysStoppedAnimation(
                                            proc.status == 'COMPLETED'
                                                ? Colors.green
                                                : const Color(0xFF7c3aed),
                                          ),
                                          minHeight: 8,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      '${proc.progressPercentage}%',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                              ],
                              if (proc.currentDepartments.isNotEmpty)
                                Text(
                                  'Departamento actual: ${proc.currentDepartments.join(', ')}',
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 13,
                                  ),
                                ),
                              Text(
                                'Creado: ${DateFormat('dd/MM/yyyy HH:mm').format(proc.createdAt)}',
                                style: TextStyle(
                                  color: Colors.grey[500],
                                  fontSize: 12,
                                ),
                              ),
                              if (proc.finalObservation != null &&
                                  proc.finalObservation!.isNotEmpty) ...[
                                const Divider(),
                                Text(
                                  'Resultado:',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.green[700],
                                  ),
                                ),
                                Text(
                                  proc.finalObservation!,
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                  ),
      ),
    );
  }
}