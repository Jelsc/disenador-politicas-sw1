import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:record/record.dart';

import '../models/ai_request_draft.dart';
import '../services/api_service.dart';

enum AiRequestMode { intake, analyst, report, formAssist }

class AiRequestScreen extends StatefulWidget {
  final ApiService apiService;
  final AudioCaptureController audioRecorder;

  AiRequestScreen({super.key, ApiService? apiService, AudioCaptureController? audioRecorder})
      : apiService = apiService ?? ApiService(),
        audioRecorder = audioRecorder ?? RecordAudioCaptureController();

  @override
  State<AiRequestScreen> createState() => _AiRequestScreenState();
}

class _AiRequestScreenState extends State<AiRequestScreen> {
  final AiRequestDraftStore _draftStore = const AiRequestDraftStore();
  final TextEditingController _inputController = TextEditingController();
  final TextEditingController _audioController = TextEditingController();

  AiRequestMode _mode = AiRequestMode.intake;
  bool _useAudioPayload = false;
  bool _isRecording = false;
  bool _loading = false;
  bool _restoringDraft = false;
  String? _message;
  Map<String, dynamic>? _response;
  AiRequestDraft? _draft;

  @override
  void initState() {
    super.initState();
    _inputController.addListener(_syncDraftFromFields);
    _audioController.addListener(_syncDraftFromFields);
    _restoreDraft();
  }

  @override
  void dispose() {
    _syncDraftFromFields(forceSave: true);
    _inputController.removeListener(_syncDraftFromFields);
    _audioController.removeListener(_syncDraftFromFields);
    _inputController.dispose();
    _audioController.dispose();
    unawaited(widget.audioRecorder.dispose());
    super.dispose();
  }

  AiRequestMode _modeFromName(String? name) {
    return switch (name) {
      'analyst' => AiRequestMode.analyst,
      'report' => AiRequestMode.report,
      'formAssist' => AiRequestMode.formAssist,
      _ => AiRequestMode.intake,
    };
  }

  Future<void> _restoreDraft() async {
    final draft = await _draftStore.load();
    if (!mounted || draft == null) {
      return;
    }

    _restoringDraft = true;
    setState(() {
      _draft = draft;
      _mode = _modeFromName(draft.modeName);
      _useAudioPayload = draft.useAudioPayload;
      _inputController.text = draft.text;
      _audioController.text = draft.audioBase64;
    });
    _restoringDraft = false;
  }

  AiRequestDraft _buildDraftFromState() {
    return AiRequestDraft(
      modeName: _mode.name,
      text: _inputController.text.trim(),
      audioBase64: _audioController.text.trim(),
      useAudioPayload: _useAudioPayload,
      updatedAt: DateTime.now(),
    );
  }

  Future<void> _syncDraftFromFields({bool forceSave = false}) async {
    if (_restoringDraft || _loading) {
      return;
    }

    final draft = _buildDraftFromState();
    if (!forceSave && draft.isEmpty) {
      await _draftStore.clear();
      if (mounted && _draft != null) {
        setState(() => _draft = null);
      }
      return;
    }

    await _draftStore.save(draft);
  }

  Future<void> _discardDraft() async {
    _restoringDraft = true;
    await _draftStore.clear();
    if (!mounted) return;
    _inputController.clear();
    _audioController.clear();
    setState(() {
      _draft = null;
      _useAudioPayload = false;
      _mode = AiRequestMode.intake;
      _message = 'Borrador descartado.';
      _response = null;
    });
    _restoringDraft = false;
  }

  String _buildRecordingPath() {
    return '${Directory.systemTemp.path}${Platform.pathSeparator}ai_request_${DateTime.now().microsecondsSinceEpoch}.m4a';
  }

  Future<void> _startRecording() async {
    if (_loading || _isRecording) {
      return;
    }

    final hasPermission = await widget.audioRecorder.hasPermission();
    if (!hasPermission) {
      if (!mounted) return;
      setState(() => _message = 'Necesitás habilitar el micrófono para grabar.');
      return;
    }

    try {
      final path = _buildRecordingPath();
      await widget.audioRecorder.start(path: path);
      if (!mounted) return;
      setState(() {
        _isRecording = true;
        _useAudioPayload = true;
        _message = 'Grabando audio...';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'No se pudo iniciar la grabación.');
    }
  }

  Future<void> _stopRecording() async {
    if (_loading || !_isRecording) {
      return;
    }

    try {
      final path = await widget.audioRecorder.stop();
      if (!mounted) return;

      if (path == null || path.isEmpty) {
        setState(() {
          _isRecording = false;
          _message = 'No se pudo recuperar el audio grabado.';
        });
        return;
      }

      final file = File(path);
      if (!await file.exists()) {
        setState(() {
          _isRecording = false;
          _message = 'No se encontró el archivo de audio grabado.';
        });
        return;
      }

      final bytes = await file.readAsBytes();
      if (await file.exists()) {
        await file.delete();
      }

      setState(() {
        _isRecording = false;
        _useAudioPayload = true;
      });
      _audioController.text = base64Encode(bytes);
      await _syncDraftFromFields(forceSave: true);
      if (!mounted) return;
      setState(() => _message = 'Audio capturado. Listo para enviar.');
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isRecording = false;
        _message = 'No se pudo completar la captura de audio.';
      });
    }
  }

  Future<void> _submit() async {
    final text = _inputController.text.trim();
    final audioBase64 = _audioController.text.trim();
    if (text.isEmpty && (!_useAudioPayload || audioBase64.isEmpty)) {
      setState(() => _message = 'Ingresá un texto para enviar a IA.');
      return;
    }

    setState(() {
      _loading = true;
      _message = null;
      _response = null;
    });

    final continuationContext = _buildDraftFromState().continuationContext;

    final result = switch (_mode) {
      AiRequestMode.intake => await widget.apiService.submitAiVoiceIntake(
          text: _useAudioPayload ? null : text,
          audioBase64: _useAudioPayload ? audioBase64 : null,
          policyName: 'Solicitud móvil',
          context: continuationContext,
        ),
      AiRequestMode.analyst => await widget.apiService.requestAiAnalystInsights(
          requestText: text,
          policyName: 'Solicitud móvil',
        ),
      AiRequestMode.report => await widget.apiService.requestAiReportDraft(
          text: text,
          transcript: text,
          policyName: 'Solicitud móvil',
          context: continuationContext,
        ),
      AiRequestMode.formAssist => await widget.apiService.requestAiFormAssist(
          text: text,
          policyName: 'Solicitud móvil',
          context: {
            'clientName': 'Solicitud móvil',
            ...continuationContext,
          },
          formFields: const [
            {'id': 'motivo', 'label': 'Motivo', 'type': 'LONG_TEXT', 'required': true},
            {'id': 'confirmacion', 'label': 'Confirmación', 'type': 'CHECKBOX', 'required': true},
            {'id': 'firma', 'label': 'Firma', 'type': 'SIGNATURE', 'required': false},
          ],
        ),
    };

    if (!mounted) return;
    final success = result['success'] != false;
    if (success) {
      await _draftStore.clear();
    }

    setState(() {
      _loading = false;
      _response = result;
      _draft = success ? null : _draft;
      _message = success
          ? 'Solicitud enviada correctamente.'
          : result['message']?.toString() ?? 'No se pudo completar la solicitud.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Solicitudes IA'),
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Capturá texto y enviá la consulta al servicio IA.',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          if (_draft != null) ...[
            _buildDraftBanner(),
            const SizedBox(height: 16),
          ],
          DropdownButtonFormField<AiRequestMode>(
            key: ValueKey(_mode.name),
            initialValue: _mode,
            decoration: const InputDecoration(labelText: 'Tipo de solicitud'),
            items: const [
              DropdownMenuItem(value: AiRequestMode.intake, child: Text('Intake / dictado')),
              DropdownMenuItem(value: AiRequestMode.analyst, child: Text('Análisis')),
              DropdownMenuItem(value: AiRequestMode.report, child: Text('Reporte')),
              DropdownMenuItem(value: AiRequestMode.formAssist, child: Text('Asistencia de formulario')),
            ],
            onChanged: _loading
                ? null
                : (value) {
                    setState(() => _mode = value ?? AiRequestMode.intake);
                    _syncDraftFromFields();
                  },
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _inputController,
            enabled: !_loading,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: 'Texto para la IA',
              hintText: 'Describí lo que necesitás o dictá el pedido...',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          if (_mode == AiRequestMode.intake) ...[
            _buildVoiceCaptureCard(),
            const SizedBox(height: 12),
          ],
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _useAudioPayload,
            onChanged: _loading
                ? null
                : (value) {
                    setState(() => _useAudioPayload = value);
                    _syncDraftFromFields();
                  },
            title: const Text('Usar payload de audio base64'),
            subtitle: const Text('Activalo si querés continuar una captura de voz o probar el flujo sin grabar audio.'),
          ),
          if (_useAudioPayload) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _audioController,
              enabled: !_loading,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Audio base64',
                hintText: 'Pegá el audio codificado en base64 o continuá la captura guardada...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            key: const Key('ai-request-submit'),
            onPressed: _loading || _isRecording ? null : _submit,
            icon: _loading
                ? const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.auto_awesome),
            label: Text(_loading ? 'Enviando...' : 'Enviar a IA'),
          ),
          if (_message != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(_message!),
              ),
            ),
          ],
          if (_response != null) ...[
            const SizedBox(height: 16),
            const Text('Respuesta', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (_response?['policyAssignment'] != null ||
                _response?['suggestedNextAction'] != null ||
                _response?['route'] != null ||
                _response?['reportType'] != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_response?['policyAssignment'] != null)
                        Text('Policy assignment: ${_response?['policyAssignment']}'),
                      if (_response?['route'] != null) Text('Route: ${_response?['route']}'),
                      if (_response?['reportType'] != null) Text('Report type: ${_response?['reportType']}'),
                      if (_response?['suggestedNextAction'] != null)
                        Text('Next action: ${_response?['suggestedNextAction']}'),
                      if (_response?['confidence'] != null) Text('Confidence: ${_response?['confidence']}'),
                    ],
                  ),
                ),
              ),
            if (_response?['suggestedFields'] is List && (_response?['suggestedFields'] as List).isNotEmpty) ...[
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Suggested fields', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      ...(_response?['suggestedFields'] as List).map((item) {
                        final field = Map<String, dynamic>.from(item as Map);
                        final label = field['label']?.toString() ?? field['fieldId']?.toString() ?? 'Field';
                        final value = field['suggestedValue']?.toString() ?? '';
                        return Text('$label: $value');
                      }),
                    ],
                  ),
                ),
              ),
            ],
            SelectableText(const JsonEncoder.withIndent('  ').convert(_response)),
          ],
        ],
      ),
    );
  }

  Widget _buildDraftBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFD99B45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.schedule_send_outlined, color: Color(0xFF92400E)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Borrador guardado',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(_draft!.summary),
          const SizedBox(height: 4),
          Text(
            'Reanudá la captura desde donde la dejaste. El texto y el audio se conservan hasta que envíes o descartes el borrador.',
            style: TextStyle(color: Colors.brown.shade700),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              TextButton(
                onPressed: _loading ? null : _discardDraft,
                child: const Text('Descartar'),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: _loading
                    ? null
                    : () {
                        FocusScope.of(context).unfocus();
                        setState(() => _message = 'Continuación lista para enviar.');
                      },
                icon: const Icon(Icons.play_arrow),
                label: const Text('Reanudar'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVoiceCaptureCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFBF4E8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE3C48A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Captura de voz',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            _isRecording
                ? 'La grabación está en curso. Detenela para convertir el audio a base64.'
                : 'Grabá tu respuesta, detené la captura y enviá el audio por el contrato existente.',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              FilledButton.icon(
                onPressed: (_loading || _isRecording) ? null : _startRecording,
                icon: const Icon(Icons.mic_none_outlined),
                label: const Text('Iniciar grabación'),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: (_loading || !_isRecording) ? null : _stopRecording,
                icon: const Icon(Icons.stop_circle_outlined),
                label: const Text('Detener grabación'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _isRecording ? 'Grabando audio...' : 'Esperando una nueva captura.',
            style: TextStyle(
              color: _isRecording ? const Color(0xFF92400E) : Colors.brown.shade700,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

abstract class AudioCaptureController {
  const AudioCaptureController();

  Future<bool> hasPermission();

  Future<void> start({required String path});

  Future<String?> stop();

  Future<void> dispose();
}

class RecordAudioCaptureController extends AudioCaptureController {
  RecordAudioCaptureController();

  final AudioRecorder _recorder = AudioRecorder();

  @override
  Future<bool> hasPermission() => _recorder.hasPermission();

  @override
  Future<void> start({required String path}) => _recorder.start(const RecordConfig(), path: path);

  @override
  Future<String?> stop() => _recorder.stop();

  @override
  Future<void> dispose() async {
    final dynamic recorder = _recorder;
    final result = recorder.dispose();
    if (result is Future) {
      await result;
    }
  }
}
