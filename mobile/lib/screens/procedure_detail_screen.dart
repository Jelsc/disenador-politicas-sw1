import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/procedure_ticket.dart';
import '../services/api_service.dart';
import 'signature_capture_screen.dart';

class ProcedureDetailScreen extends StatefulWidget {
  final ProcedureTicket procedure;
  final String? initialTaskId;
  final String? initialFieldId;

  const ProcedureDetailScreen({
    super.key,
    required this.procedure,
    this.initialTaskId,
    this.initialFieldId,
  });

  @override
  State<ProcedureDetailScreen> createState() => _ProcedureDetailScreenState();
}

class _ProcedureDetailScreenState extends State<ProcedureDetailScreen> {
  final ApiService _api = ApiService();
  bool _isUploadingSignature = false;
  Uint8List? _lastSignature;

  SignatureRequest? get _focusedSignature {
    final requests = widget.procedure.pendingSignatureRequests;
    if (requests.isEmpty) return null;
    for (final request in requests) {
      if (request.taskId == widget.initialTaskId ||
          request.fieldId == widget.initialFieldId) {
        return request;
      }
    }
    return requests.first;
  }

  Future<void> _startSignature(SignatureRequest request) async {
    final bytes = await Navigator.push<Uint8List>(
      context,
      MaterialPageRoute(
        builder: (_) => SignatureCaptureScreen(
          title: request.label,
          message: request.message,
        ),
      ),
    );
    if (bytes == null) return;
    await _submitSignature(request, bytes);
  }

  Future<void> _submitSignature(
    SignatureRequest request,
    Uint8List bytes,
  ) async {
    setState(() => _isUploadingSignature = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final success =
        token != null &&
        await _api.submitClientSignature(
          token: token,
          procedureId: widget.procedure.id,
          taskId: request.taskId,
          fieldId: request.fieldId,
          imageBase64: base64Encode(bytes),
        );

    if (!mounted) return;
    setState(() {
      _isUploadingSignature = false;
      if (success) _lastSignature = bytes;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success
              ? 'Firma enviada correctamente.'
              : 'No se pudo enviar la firma.',
        ),
        backgroundColor: success ? const Color(0xFF166534) : Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proc = widget.procedure;
    final signature = _focusedSignature;

    return Scaffold(
      backgroundColor: const Color(0xFFF6F1E8),
      appBar: AppBar(
        title: const Text('Expediente del trámite'),
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _expedienteCard(proc),
          const SizedBox(height: 14),
          _trackingCard(proc),
          const SizedBox(height: 14),
          if (signature != null)
            _signatureCard(signature)
          else
            _noSignatureCard(),
          if (_lastSignature != null) ...[
            const SizedBox(height: 14),
            _signaturePreview(),
          ],
        ],
      ),
    );
  }

  Widget _expedienteCard(ProcedureTicket proc) {
    return _surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.folder_open_outlined, color: Color(0xFF7C4A20)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  proc.policyName,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _keyValue('ID del trámite', proc.id),
          if (proc.clientName != null)
            _keyValue('Titular', '${proc.clientName} (CI: ${proc.clientCi})'),
          _keyValue(
            'Inicio',
            DateFormat('dd/MM/yyyy HH:mm').format(proc.createdAt),
          ),
          if (proc.finalObservation != null &&
              proc.finalObservation!.isNotEmpty)
            _keyValue('Resolución', proc.finalObservation!),
        ],
      ),
    );
  }

  Widget _trackingCard(ProcedureTicket proc) {
    return _surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Seguimiento',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: proc.progressPercentage / 100,
              minHeight: 10,
              backgroundColor: const Color(0xFFE9DEC9),
              valueColor: const AlwaysStoppedAnimation(Color(0xFF6D5A3D)),
            ),
          ),
          const SizedBox(height: 10),
          Text('${proc.progressPercentage}% completado'),
          if (proc.currentTasks.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...proc.currentTasks.map((task) => _timelineRow(task, 'En curso')),
          ],
          if (proc.currentDepartments.isNotEmpty)
            _keyValue(
              'Departamento actual',
              proc.currentDepartments.join(', '),
            ),
        ],
      ),
    );
  }

  Widget _signatureCard(SignatureRequest request) {
    return _surface(
      accent: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.draw_outlined, color: Color(0xFF92400E)),
              SizedBox(width: 10),
              Text(
                'Firma requerida',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(request.message),
          const SizedBox(height: 8),
          Text(
            'Etapa: ${request.taskLabel}',
            style: const TextStyle(color: Color(0xFF7B7063)),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _isUploadingSignature
                ? null
                : () => _startSignature(request),
            icon: _isUploadingSignature
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.edit_outlined),
            label: Text(
              _isUploadingSignature
                  ? 'Enviando firma...'
                  : 'Firmar con el dedo',
            ),
          ),
        ],
      ),
    );
  }

  Widget _noSignatureCard() {
    return _surface(
      child: const Row(
        children: [
          Icon(Icons.verified_outlined, color: Color(0xFF166534)),
          SizedBox(width: 10),
          Expanded(child: Text('No tenés firmas pendientes en este trámite.')),
        ],
      ),
    );
  }

  Widget _signaturePreview() {
    return _surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Última firma enviada',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Container(
            height: 120,
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE3D8C5)),
            ),
            child: Image.memory(_lastSignature!),
          ),
        ],
      ),
    );
  }

  Widget _surface({required Widget child, bool accent = false}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: accent ? const Color(0xFFFFF7E8) : const Color(0xFFFFFCF6),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: accent ? const Color(0xFFD99B45) : const Color(0xFFE3D8C5),
        ),
      ),
      child: child,
    );
  }

  Widget _keyValue(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFF7B7063), fontSize: 12),
          ),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _timelineRow(String title, String status) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          const Icon(
            Icons.radio_button_checked,
            color: Color(0xFFB45309),
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Text(status, style: const TextStyle(color: Color(0xFF7B7063))),
        ],
      ),
    );
  }
}
