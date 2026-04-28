import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/client_notification.dart';

class NotificationsScreen extends StatelessWidget {
  final List<ClientNotification> notifications;
  final Future<void> Function(ClientNotification notification)
  onNotificationTap;

  const NotificationsScreen({
    super.key,
    required this.notifications,
    required this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F1E8),
      appBar: AppBar(
        title: const Text('Notificaciones'),
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
        elevation: 0,
      ),
      body: notifications.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('Todavía no llegaron avisos de tus trámites.'),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: notifications.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final notification = notifications[index];
                return _NotificationCard(
                  notification: notification,
                  onTap: () async {
                    await onNotificationTap(notification);
                    if (context.mounted) Navigator.pop(context);
                  },
                );
              },
            ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final ClientNotification notification;
  final Future<void> Function() onTap;

  const _NotificationCard({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final signature = notification.type.contains('SIGNATURE');
    return Card(
      elevation: 0,
      color: notification.read
          ? const Color(0xFFFFFCF6)
          : const Color(0xFFFFF7E8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: notification.read
              ? const Color(0xFFE3D8C5)
              : const Color(0xFFD99B45),
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: signature
                    ? const Color(0xFFFFE8C7)
                    : const Color(0xFFEDE3D1),
                foregroundColor: signature
                    ? const Color(0xFF92400E)
                    : const Color(0xFF5B4B35),
                child: Icon(
                  signature ? Icons.draw_outlined : Icons.description_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        if (!notification.read)
                          Container(
                            width: 9,
                            height: 9,
                            decoration: const BoxDecoration(
                              color: Color(0xFFB45309),
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(notification.body),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text(
                          DateFormat(
                            'dd/MM/yyyy HH:mm',
                          ).format(notification.createdAt),
                          style: const TextStyle(
                            color: Color(0xFF7B7063),
                            fontSize: 12,
                          ),
                        ),
                        const Spacer(),
                        const Icon(
                          Icons.chevron_right,
                          color: Color(0xFF7B7063),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
