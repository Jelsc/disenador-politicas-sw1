import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/procedure_ticket.dart';
import '../services/api_service.dart';

class RepositoryScreen extends StatefulWidget {
  final ProcedureTicket procedure;
  final ApiService? apiService;

  const RepositoryScreen({
    super.key,
    required this.procedure,
    this.apiService,
  });

  @override
  State<RepositoryScreen> createState() => _RepositoryScreenState();
}

class _RepositoryScreenState extends State<RepositoryScreen> {
  bool _loading = true;
  String? _error;
  List<ProcedureRepositoryDocument> _documents = [];

  ApiService get _api => widget.apiService ?? ApiService();

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'No se encontró la sesión para consultar documentos.';
      });
      return;
    }

    final documents = await _api.getProcedureDocuments(token, widget.procedure.id);
    if (!mounted) return;
    setState(() {
      _documents = documents;
      _loading = false;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F1E8),
      appBar: AppBar(
        title: const Text('Repositorio documental'),
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
        elevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Text(_error!, style: const TextStyle(color: Colors.red)),
      );
    }
    if (_documents.isEmpty) {
      return const Center(
        child: Text('No hay documentos en el repositorio de este trámite.'),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _documents.length,
      itemBuilder: (context, index) {
        return _documentRow(_documents[index]);
      },
    );
  }

  Widget _documentRow(ProcedureRepositoryDocument document) {
    final createdAt = document.createdAt != null
        ? DateFormat('dd/MM/yyyy HH:mm').format(document.createdAt!)
        : 'Sin fecha';
    final sizeKb = (document.size / 1024).toStringAsFixed(1);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
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
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF6F1E8),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('v${document.version}', style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Acción: ${document.traceAction ?? 'S/A'}', style: const TextStyle(fontWeight: FontWeight.w500)),
          if (document.traceNote != null && document.traceNote!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(document.traceNote!, style: const TextStyle(color: Color(0xFF5A5044))),
            ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: Color(0xFFE3D8C5)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Por: ${document.createdBy ?? 'desconocido'}',
                style: const TextStyle(color: Color(0xFF7B7063), fontSize: 12),
              ),
              Text(
                '$createdAt · $sizeKb KB',
                style: const TextStyle(color: Color(0xFF7B7063), fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
