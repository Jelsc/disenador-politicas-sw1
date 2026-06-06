import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/screens/ai_request_screen.dart';
import 'package:mobile/services/api_service.dart';

class FakeAiApiService extends ApiService {
  String? lastIntakeText;
  String? lastIntakeAudioBase64;
  String? lastAnalystText;
  String? lastReportText;
  String? lastFormAssistText;

  @override
  Future<Map<String, dynamic>> submitAiVoiceIntake({String? text, String? audioBase64, String? policyName, Map<String, dynamic>? context}) async {
    lastIntakeText = text;
    lastIntakeAudioBase64 = audioBase64;
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
  Future<Map<String, dynamic>> requestAiReportDraft({String? text, String? transcript, String? policyName}) async {
    lastReportText = text;
    return {'draftTitle': 'Reporte borrador', 'success': true};
  }

  @override
  Future<Map<String, dynamic>> requestAiFormAssist({String? text, String? audioBase64, String? policyName, Map<String, dynamic>? context, List<Map<String, dynamic>>? formFields}) async {
    lastFormAssistText = text;
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
  testWidgets('envía una solicitud IA desde texto', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));

    await tester.enterText(find.byType(TextField), 'Necesito un reporte urgente');
    await tester.tap(find.text('Enviar a IA'));
    await tester.pumpAndSettle();

    expect(api.lastIntakeText, 'Necesito un reporte urgente');
    expect(find.text('Solicitud enviada correctamente.'), findsOneWidget);
    expect(find.textContaining('Reporte borrador'), findsNothing);
  });

  testWidgets('envía una solicitud IA desde audio base64', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));

    await tester.tap(find.text('Usar payload de audio base64'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'U29saWNpdG8gYXl1ZGEgYXN0aWFsdm8=');
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ai-request-submit')));
    await tester.pumpAndSettle();

    expect(api.lastIntakeText, isNull);
    expect(api.lastIntakeAudioBase64, 'U29saWNpdG8gYXl1ZGEgYXN0aWFsdm8=');
  });

  testWidgets('cambia el modo de solicitud y usa el contrato correcto', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));

    await tester.tap(find.text('Intake / dictado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reporte').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Borrador de informe');
    await tester.tap(find.text('Enviar a IA'));
    await tester.pumpAndSettle();

    expect(api.lastReportText, 'Borrador de informe');
    expect(find.text('Solicitud enviada correctamente.'), findsOneWidget);
  });

  testWidgets('usa la asistencia de formulario y muestra el resumen estructurado', (tester) async {
    final api = FakeAiApiService();

    await tester.pumpWidget(MaterialApp(home: AiRequestScreen(apiService: api)));

    await tester.tap(find.text('Intake / dictado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Asistencia de formulario').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Solicito ayuda para completar el formulario');
    await tester.tap(find.text('Enviar a IA'));
    await tester.pumpAndSettle();

    expect(api.lastFormAssistText, 'Solicito ayuda para completar el formulario');
    expect(find.text('Solicitud enviada correctamente.'), findsOneWidget);
  });
}
