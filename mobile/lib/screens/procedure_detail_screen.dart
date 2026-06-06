import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/procedure_ticket.dart';
import '../services/api_service.dart';
import 'signature_capture_screen.dart';

typedef ProcedureDocumentPicker = Future<SelectedProcedureDocument?> Function();

class SelectedProcedureDocument {
  final String fileName;
  final Uint8List bytes;

  const SelectedProcedureDocument({required this.fileName, required this.bytes});
}

class ProcedureDetailScreen extends StatefulWidget {
  final ProcedureTicket procedure;
  final String? initialTaskId;
  final String? initialFieldId;
  final ApiService? apiService;
  final ProcedureDocumentPicker? documentPicker;

  const ProcedureDetailScreen({
    super.key,
    required this.procedure,
    this.initialTaskId,
    this.initialFieldId,
    this.apiService,
    this.documentPicker,
  });

  @override
  State<ProcedureDetailScreen> createState() => _ProcedureDetailScreenState();
}

class _ProcedureDetailScreenState extends State<ProcedureDetailScreen> {
  bool _isUploadingSignature = false;
  Uint8List? _lastSignature;
  bool _loadingDocuments = true;
  bool _uploadingDocument = false;
  String? _documentError;
  List<ProcedureRepositoryDocument> _documents = [];

  ApiService get _api => widget.apiService ?? ApiService();

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

  @override
  void initState() {
    super.initState();
    _loadDocumentRepository();
  }

  Future<void> _loadDocumentRepository() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      if (!mounted) return;
      setState(() {
        _loadingDocuments = false;
        _documentError = 'No se encontró la sesión para consultar documentos.';
      });
      return;
    }

    final documents = await _api.getProcedureDocuments(token, widget.procedure.id);
    if (!mounted) return;
    setState(() {
      _documents = documents;
      _loadingDocuments = false;
      _documentError = null;
    });
  }

  Future<void> _pickAndUploadDocument() async {
    final picker = widget.documentPicker ?? _defaultDocumentPicker;
    final selected = await picker();
    if (selected == null) return;

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se encontró la sesión para subir documentos.')),
      );
      return;
    }

    setState(() => _uploadingDocument = true);
    final success = await _api.uploadProcedureDocument(
      token: token,
      procedureId: widget.procedure.id,
      fileName: selected.fileName,
      bytes: selected.bytes,
    );
    if (!mounted) return;
    setState(() => _uploadingDocument = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? 'Documento cargado correctamente.' : 'No se pudo cargar el documento.'),
        backgroundColor: success ? const Color(0xFF166534) : Colors.red,
      ),
    );
    if (success) {
      setState(() => _loadingDocuments = true);
      await _loadDocumentRepository();
    }
  }

  Future<SelectedProcedureDocument?> _defaultDocumentPicker() async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    final file = result == null || result.files.isEmpty ? null : result.files.first;
    if (file == null || file.bytes == null) return null;
    return SelectedProcedureDocument(fileName: file.name, bytes: file.bytes!);
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
          _documentRepositoryCard(),
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

  Widget _documentRepositoryCard() {
    return _surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.folder_copy_outlined, color: Color(0xFF7C4A20)),
              SizedBox(width: 10),
              Text(
                'Repositorio documental',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _uploadingDocument ? null : _pickAndUploadDocument,
            icon: _uploadingDocument
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.upload_file_outlined),
            label: Text(_uploadingDocument ? 'Cargando...' : 'Subir documento'),
          ),
          const SizedBox(height: 12),
          if (_loadingDocuments)
            const Center(child: CircularProgressIndicator())
          else if (_documentError != null)
            Text(_documentError!, style: const TextStyle(color: Colors.red))
          else if (_documents.isEmpty)
            const Text('Todavía no hay documentos visibles para este trámite.')
          else
            ..._documents.map(_documentRow),
        ],
      ),
    );
  }

  Widget _documentRow(ProcedureRepositoryDocument document) {
    final createdAt = document.createdAt != null
        ? DateFormat('dd/MM/yyyy HH:mm').format(document.createdAt!)
        : 'Sin fecha';
    final sizeKb = (document.size / 1024).toStringAsFixed(1);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE3D8C5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.description_outlined, color: Color(0xFF6D5A3D)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  document.originalFileName,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              Text('v${document.version}', style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 8),
          Text('Trazabilidad: ${document.traceAction ?? 'SIN_ACCION'}'),
          if (document.traceNote != null && document.traceNote!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(document.traceNote!),
            ),
          const SizedBox(height: 6),
          Text(
            'Registrado por ${document.createdBy ?? 'desconocido'} · $createdAt · $sizeKb KB',
            style: const TextStyle(color: Color(0xFF7B7063), fontSize: 12),
          ),
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
