import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/models/ai_request_draft.dart';

void main() {
  test('round trips the saved AI request draft', () {
    final draft = AiRequestDraft(
      modeName: 'formAssist',
      text: 'Necesito ayuda con el formulario',
      audioBase64: 'YWJjMTIz',
      useAudioPayload: true,
      updatedAt: DateTime.parse('2026-06-07T10:15:00Z'),
    );

    final restored = AiRequestDraft.fromJson(draft.toJson());

    expect(restored.modeName, draft.modeName);
    expect(restored.text, draft.text);
    expect(restored.audioBase64, draft.audioBase64);
    expect(restored.useAudioPayload, isTrue);
    expect(restored.updatedAt, draft.updatedAt);
    expect(restored.summary, contains('Asistencia de formulario'));
  });

  test('stores and clears the draft in shared preferences', () async {
    SharedPreferences.setMockInitialValues({});
    final store = AiRequestDraftStore();
    final draft = AiRequestDraft(
      modeName: 'intake',
      text: 'Dictado parcial',
      audioBase64: '',
      useAudioPayload: false,
      updatedAt: DateTime.parse('2026-06-07T10:15:00Z'),
    );

    await store.save(draft);
    final loaded = await store.load();

    expect(loaded, isNotNull);
    expect(loaded!.text, draft.text);
    expect(jsonDecode((await SharedPreferences.getInstance()).getString(AiRequestDraftStore.storageKey)!)['modeName'], 'intake');

    await store.clear();
    expect(await store.load(), isNull);
  });
}
