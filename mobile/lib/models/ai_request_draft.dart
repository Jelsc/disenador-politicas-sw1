import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AiRequestDraft {
  static const storageKey = 'ai_request_draft';

  final String modeName;
  final String text;
  final String audioBase64;
  final bool useAudioPayload;
  final DateTime updatedAt;

  const AiRequestDraft({
    required this.modeName,
    required this.text,
    required this.audioBase64,
    required this.useAudioPayload,
    required this.updatedAt,
  });

  bool get isEmpty => text.trim().isEmpty && audioBase64.trim().isEmpty;

  String get modeLabel {
    return switch (modeName) {
      'analyst' => 'Análisis',
      'report' => 'Reporte',
      'formAssist' => 'Asistencia de formulario',
      _ => 'Intake / dictado',
    };
  }

  String get summary {
    final content = text.trim().isNotEmpty
        ? text.trim()
        : audioBase64.trim().isNotEmpty
            ? 'Audio guardado'
            : 'Borrador vacío';
    return '$modeLabel · $content';
  }

  Map<String, dynamic> get continuationContext => {
        'draftMode': modeName,
        'draftLabel': modeLabel,
        'draftText': text.trim(),
        'partialTranscript': text.trim(),
        'draftAudioLength': audioBase64.trim().length,
        'hasAudioPayload': audioBase64.trim().isNotEmpty,
        'useAudioPayload': useAudioPayload,
        'draftUpdatedAt': updatedAt.toIso8601String(),
      };

  Map<String, dynamic> toJson() => {
        'modeName': modeName,
        'text': text,
        'audioBase64': audioBase64,
        'useAudioPayload': useAudioPayload,
        'updatedAt': updatedAt.toIso8601String(),
      };

  String toStorageValue() => jsonEncode(toJson());

  factory AiRequestDraft.fromJson(Map<String, dynamic> json) {
    return AiRequestDraft(
      modeName: json['modeName']?.toString() ?? 'intake',
      text: json['text']?.toString() ?? '',
      audioBase64: json['audioBase64']?.toString() ?? '',
      useAudioPayload: json['useAudioPayload'] == true,
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  factory AiRequestDraft.fromStorageValue(String? value) {
    if (value == null || value.isEmpty) {
      throw const FormatException('Empty AI request draft');
    }

    return AiRequestDraft.fromJson(Map<String, dynamic>.from(jsonDecode(value) as Map));
  }

  AiRequestDraft copyWith({
    String? modeName,
    String? text,
    String? audioBase64,
    bool? useAudioPayload,
    DateTime? updatedAt,
  }) {
    return AiRequestDraft(
      modeName: modeName ?? this.modeName,
      text: text ?? this.text,
      audioBase64: audioBase64 ?? this.audioBase64,
      useAudioPayload: useAudioPayload ?? this.useAudioPayload,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class AiRequestDraftStore {
  static const storageKey = AiRequestDraft.storageKey;

  const AiRequestDraftStore();

  Future<AiRequestDraft?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(storageKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final draft = AiRequestDraft.fromStorageValue(raw);
      return draft.isEmpty ? null : draft;
    } catch (_) {
      await prefs.remove(storageKey);
      return null;
    }
  }

  Future<void> save(AiRequestDraft draft) async {
    final prefs = await SharedPreferences.getInstance();
    if (draft.isEmpty) {
      await prefs.remove(storageKey);
      return;
    }

    await prefs.setString(storageKey, draft.toStorageValue());
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(storageKey);
  }
}
