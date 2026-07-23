import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/models/procedure_ticket.dart';
import 'package:mobile/screens/procedure_detail_screen.dart';
import 'package:mobile/services/api_service.dart';

class FakeProcedureApiService extends ApiService {
  bool uploadCalled = false;

  @override
  Future<List<ProcedureRepositoryDocument>> getProcedureDocuments(
    String token,
    String procedureId,
  ) async {
    return [
      ProcedureRepositoryDocument(
        id: '1',
        documentId: 'doc-1',
        version: 2,
        originalFileName: 'evidencia.pdf',
        size: 2048,
        createdBy: 'ana',
        traceAction: 'NEW_VERSION',
        traceNote: 'Documento actualizado',
        createdAt: DateTime(2026, 6, 6, 10, 30),
      ),
    ];
  }

  @override
  Future<Map<String, dynamic>> uploadProcedureDocument({
    required String token,
    required String procedureId,
    required String fileName,
    required Uint8List bytes,
    String? documentId,
  }) async {
    uploadCalled = true;
    return {'success': true};
  }
}

void main() {
  testWidgets('muestra el repositorio documental del trámite', (tester) async {
    SharedPreferences.setMockInitialValues({'token': 'abc'});

    final procedure = ProcedureTicket(
      id: 'proc-1',
      policyId: 'policy-1',
      policyName: 'Licencia de funcionamiento',
      status: 'OPEN',
      progressPercentage: 60,
      currentDepartments: const ['Legal'],
      currentTasks: const ['Revisión documental'],
      pendingSignatureRequests: const [], pendingClientTasks: const [],
      createdAt: DateTime(2026, 6, 1, 9, 0),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ProcedureDetailScreen(
          procedure: procedure,
          apiService: FakeProcedureApiService(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Repositorio documental'), findsOneWidget);
    expect(find.text('Abrir repositorio'), findsOneWidget);
  });
}
