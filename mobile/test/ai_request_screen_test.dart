import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/models/ai_request_draft.dart';
import 'package:mobile/screens/ai_request_screen.dart';
import 'package:mobile/services/api_service.dart';

class FakeAiApiService extends ApiService {
  String? lastIntakeText;
  String? lastIntakeAudioBase64;
  Map<String, dynamic>? lastIntakeContext;
  String? lastAnalystText;
  String? lastReportText;
  Map<String, dynamic>? lastReportContext;
  String? lastFormAssistText;
  Map<String, dynamic>? lastFormAssistContext;

  @override
  Future<Map<String, dynamic>> submitAiVoiceIntake({String? text, String? audioBase64, String? policyName, Map<String, dynamic>? context}) async {
    lastIntakeText = text;
    lastIntakeAudioBase64 = audioBase64;
    lastIntakeContext = context;
    return {
      'transcript': text ?? 'audio transcript',
      'policyAssignment': 'policy-intake',
      'suggestedNextAction': 'Route to intake review.',
      'confidence': 0.91,
      'success': true,
    };
  }

  @override
  Future<Map<String, dynamic>> requestAiAnalystInsights({required String requestText, String? policyName}) async {
    lastAnalystText = requestText;
    return {'route': 'mesa-analisis', 'success': true};
  }

  @override
  Future<Map<String, dynamic>> requestAiReportDraft({String? text, String? transcript, String? policyName, Map<String, dynamic>? context}) async {
    lastReportText = text;
    lastReportContext = context;
    return {'draftTitle': 'Reporte borrador', 'success': true};
  }

  @override
  Future<Map<String, dynamic>> requestAiFormAssist({String? text, String? audioBase64, String? policyName, Map<String, dynamic>? context, List<Map<String, dynamic>>? formFields}) async {
    lastFormAssistText = text;
    lastFormAssistContext = context;
    return {
      'transcript': text ?? '',
      'policyAssignment': 'policy-form-assist',
      'suggestedFields': [
        {'fieldId': 'motivo', 'label': 'Motivo', 'suggestedValue': text ?? ''},
      ],
      'success': true,
    };
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('envía una solicitud IA desde texto', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.enterText(find.byType(TextField), 'Necesito un reporte urgente');
    tester.testTextInput.hide();
    await tester.pump();
    await tester.fling(find.byType(ListView), const Offset(0, -1000), 1000);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ai-request-submit')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastIntakeText, 'Necesito un reporte urgente');
    expect(api.lastIntakeContext?['draftMode'], 'intake');
    expect(find.textContaining('Reporte borrador'), findsNothing);
  });

  testWidgets('envía una solicitud IA desde audio base64', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.drag(find.byType(Scrollable).first, const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Usar payload de audio base64'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Audio base64'), base64Encode([9, 8, 7, 6]));
    tester.testTextInput.hide();
    await tester.pump();

    await tester.tap(find.byKey(const Key('ai-request-submit')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastIntakeText, isNull);
    expect(api.lastIntakeAudioBase64, base64Encode([9, 8, 7, 6]));
  });

  testWidgets('cambia el modo de solicitud y usa el contrato correcto', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    tester.testTextInput.hide();
    await tester.tap(find.text('Intake / dictado'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('Reporte').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.enterText(find.byType(TextField), 'Borrador de informe');
    await tester.dragUntilVisible(
      find.byKey(const Key('ai-request-submit')),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.tap(find.byKey(const Key('ai-request-submit')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastReportText, 'Borrador de informe');
    expect(api.lastReportContext?['draftMode'], 'report');
  });

  testWidgets('usa la asistencia de formulario y muestra el resumen estructurado', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('Intake / dictado'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('Asistencia de formulario').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.enterText(find.byType(TextField), 'Solicito ayuda para completar el formulario');
    await tester.dragUntilVisible(
      find.byKey(const Key('ai-request-submit')),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.tap(find.byKey(const Key('ai-request-submit')));
    await tester.pump();
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Suggested fields'),
      find.byType(ListView),
      const Offset(0, -300),
    );

    expect(api.lastFormAssistText, 'Solicito ayuda para completar el formulario');
    expect(api.lastFormAssistContext?['draftMode'], 'formAssist');
    expect(find.text('Suggested fields'), findsOneWidget);
    expect(find.text('Motivo: Solicito ayuda para completar el formulario'), findsOneWidget);
  });

  testWidgets('restaura un borrador guardado y lo mantiene al volver a abrirlo', (tester) async {
    SharedPreferences.setMockInitialValues({
      AiRequestDraftStore.storageKey: AiRequestDraft(
        modeName: 'report',
        text: 'Borrador inicial',
        audioBase64: 'YWJj',
        useAudioPayload: true,
        updatedAt: DateTime.parse('2026-06-07T10:15:00Z'),
      ).toStorageValue(),
    });
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    final input = tester.widget<TextField>(find.byType(TextField).first);
    expect(input.controller?.text, 'Borrador inicial');
    expect(find.text('Borrador guardado'), findsWidgets);

    await tester.enterText(find.byType(TextField).first, 'Borrador actualizado');
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(AiRequestDraftStore.storageKey), contains('Borrador actualizado'));
  });

  testWidgets('envía contexto de continuación para la asistencia de formulario', (tester) async {
    SharedPreferences.setMockInitialValues({
      AiRequestDraftStore.storageKey: AiRequestDraft(
        modeName: 'formAssist',
        text: 'Ayuda para completar el formulario',
        audioBase64: '',
        useAudioPayload: false,
        updatedAt: DateTime.parse('2026-06-07T10:15:00Z'),
      ).toStorageValue(),
    });
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    await tester.tap(find.byKey(const Key('ai-request-submit')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastFormAssistContext?['draftMode'], 'formAssist');
    expect(api.lastFormAssistContext?['draftText'], 'Ayuda para completar el formulario');
    expect(api.lastFormAssistContext?['useAudioPayload'], isFalse);
  });

}
