import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/api_service.dart';

enum AiRequestMode { intake, analyst, report, formAssist }

class AiRequestScreen extends StatefulWidget {
  final ApiService apiService;

  AiRequestScreen({super.key, ApiService? apiService}) : apiService = apiService ?? ApiService();

  @override
  State<AiRequestScreen> createState() => _AiRequestScreenState();
}

class _AiRequestScreenState extends State<AiRequestScreen> {
  final TextEditingController _inputController = TextEditingController();
  final TextEditingController _audioController = TextEditingController();
  AiRequestMode _mode = AiRequestMode.intake;
  bool _useAudioPayload = false;
  bool _loading = false;
  String? _message;
  Map<String, dynamic>? _response;

  @override
  void dispose() {
    _inputController.dispose();
    _audioController.dispose();
    super.dispose();
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

    final result = switch (_mode) {
      AiRequestMode.intake => await widget.apiService.submitAiVoiceIntake(
        text: _useAudioPayload ? null : text,
        audioBase64: _useAudioPayload ? audioBase64 : null,
        policyName: 'Solicitud móvil',
      ),
      AiRequestMode.analyst => await widget.apiService.requestAiAnalystInsights(requestText: text, policyName: 'Solicitud móvil'),
      AiRequestMode.report => await widget.apiService.requestAiReportDraft(text: text, transcript: text, policyName: 'Solicitud móvil'),
      AiRequestMode.formAssist => await widget.apiService.requestAiFormAssist(
        text: text,
        policyName: 'Solicitud móvil',
        context: const {'clientName': 'Solicitud móvil'},
        formFields: const [
          {'id': 'motivo', 'label': 'Motivo', 'type': 'LONG_TEXT', 'required': true},
          {'id': 'confirmacion', 'label': 'Confirmación', 'type': 'CHECKBOX', 'required': true},
          {'id': 'firma', 'label': 'Firma', 'type': 'SIGNATURE', 'required': false},
        ],
      ),
    };

    if (!mounted) return;
    setState(() {
      _loading = false;
      _response = result;
      _message = result['success'] == false ? result['message']?.toString() ?? 'No se pudo completar la solicitud.' : 'Solicitud enviada correctamente.';
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
          DropdownButtonFormField<AiRequestMode>(
            initialValue: _mode,
            decoration: const InputDecoration(labelText: 'Tipo de solicitud'),
            items: const [
              DropdownMenuItem(value: AiRequestMode.intake, child: Text('Intake / dictado')),
              DropdownMenuItem(value: AiRequestMode.analyst, child: Text('Análisis')),
              DropdownMenuItem(value: AiRequestMode.report, child: Text('Reporte')),
              DropdownMenuItem(value: AiRequestMode.formAssist, child: Text('Asistencia de formulario')),
            ],
            onChanged: _loading ? null : (value) => setState(() => _mode = value ?? AiRequestMode.intake),
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
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _useAudioPayload,
            onChanged: _loading ? null : (value) => setState(() => _useAudioPayload = value),
            title: const Text('Usar payload de audio base64'),
            subtitle: const Text('Activalo si querés probar la entrada de voz sin grabar audio en la app.'),
          ),
          if (_useAudioPayload) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _audioController,
              enabled: !_loading,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Audio base64',
                hintText: 'Pegá el audio codificado en base64 para simular dictado...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            key: const Key('ai-request-submit'),
            onPressed: _loading ? null : _submit,
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
            if (_response?['policyAssignment'] != null || _response?['suggestedNextAction'] != null || _response?['route'] != null || _response?['reportType'] != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_response?['policyAssignment'] != null)
                        Text('Policy assignment: ${_response?['policyAssignment']}'),
                      if (_response?['route'] != null)
                        Text('Route: ${_response?['route']}'),
                      if (_response?['reportType'] != null)
                        Text('Report type: ${_response?['reportType']}'),
                      if (_response?['suggestedNextAction'] != null)
                        Text('Next action: ${_response?['suggestedNextAction']}'),
                      if (_response?['confidence'] != null)
                        Text('Confidence: ${_response?['confidence']}'),
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
}
