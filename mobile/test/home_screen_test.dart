import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/models/client_notification.dart';
import 'package:mobile/models/procedure_ticket.dart';
import 'package:mobile/screens/home_screen.dart';
import 'package:mobile/services/api_service.dart';

class FakeHomeApiService extends ApiService {
  @override
  Future<List<ProcedureRepositoryDocument>> getProcedureDocuments(String token, String procedureId) async {
    return [
      ProcedureRepositoryDocument(
        id: 'doc-1',
        documentId: 'document-1',
        version: 1,
        originalFileName: 'respaldo.pdf',
        size: 2048,
        createdBy: 'Sistema',
        traceAction: 'NEW_VERSION',
        traceNote: 'Carga inicial',
        createdAt: DateTime(2026, 6, 1, 12, 30),
        downloadUri: null,
      ),
    ];
  }
}

void main() {
  ProcedureTicket buildProcedure() {
    return ProcedureTicket(
      id: 'proc-1',
      policyId: 'policy-1',
      policyName: 'Licencia de funcionamiento',
      status: 'OPEN',
      clientName: 'Ana Pérez',
      clientCi: '1234567',
      progressPercentage: 65,
      currentDepartments: const ['Legal'],
      currentTasks: const ['Revisión documental'],
      pendingSignatureRequests: const [],
      pendingClientTasks: const [],
      createdAt: DateTime(2026, 6, 1, 9, 0),
    );
  }

  ClientNotification buildNotification() {
    return ClientNotification(
      id: 'n-1',
      title: 'Firma pendiente',
      body: 'Tu trámite requiere una firma.',
      type: 'SIGNATURE_REQUIRED',
      procedureId: 'proc-1',
      taskId: 'task-1',
      fieldId: 'field-1',
      read: false,
      createdAt: DateTime(2026, 6, 1, 10, 0),
    );
  }

  testWidgets('muestra notificaciones y navega al asistente IA', (tester) async {
    final api = FakeHomeApiService();

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          apiService: api,
          skipNotificationSetup: true,
          initialProcedures: [buildProcedure()],
          initialNotifications: [buildNotification()],
          initialUnreadCount: 1,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Firma pendiente'), findsOneWidget);
    expect(find.text('Firmar pendiente'), findsNothing);
    expect(find.byTooltip('Asistente Virtual'), findsOneWidget);
  });

  testWidgets('abre el detalle del trámite con repositorio', (tester) async {
    final api = FakeHomeApiService();

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          apiService: api,
          skipNotificationSetup: true,
          initialProcedures: [buildProcedure()],
          initialNotifications: [buildNotification()],
          initialUnreadCount: 1,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byKey(const Key('procedure-card-proc-1')));
    await tester.pumpAndSettle();

    expect(find.text('Repositorio documental'), findsOneWidget);
    expect(find.text('Abrir repositorio'), findsOneWidget);
  });

  testWidgets('abre la bandeja de notificaciones desde el ledger', (tester) async {
    final api = FakeHomeApiService();

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          apiService: api,
          skipNotificationSetup: true,
          initialProcedures: [buildProcedure()],
          initialNotifications: [buildNotification()],
          initialUnreadCount: 1,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Bandeja de avisos'), findsOneWidget);
    expect(find.text('Firma pendiente'), findsOneWidget);
    expect(find.text('Ver todo'), findsOneWidget);
  });

}
