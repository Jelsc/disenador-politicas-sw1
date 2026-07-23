import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/procedure_ticket.dart';
import '../services/api_service.dart';
import 'repository_screen.dart';
import 'client_task_screen.dart';

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
  ApiService get _api => widget.apiService ?? ApiService();

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    final proc = widget.procedure;

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
          _clientTasksCard(proc),
          const SizedBox(height: 14),
          _documentRepositoryCard(),
        ],
      ),
    );
  }

  Widget _clientTasksCard(ProcedureTicket proc) {
    if (proc.pendingClientTasks.isEmpty) {
      return _surface(
        child: const Row(
          children: [
            Icon(Icons.verified_outlined, color: Color(0xFF166534)),
            SizedBox(width: 10),
            Expanded(child: Text('No tenés tareas pendientes en este trámite.')),
          ],
        ),
      );
    }

    return _surface(
      accent: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.assignment_late_outlined, color: Color(0xFF92400E)),
              SizedBox(width: 10),
              Text(
                'Tareas pendientes',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Tenés ${proc.pendingClientTasks.length} tarea(s) pendiente(s) que requieren tu atención.'),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ClientTaskScreen(
                    procedure: proc,
                    task: proc.pendingClientTasks.first,
                  ),
                ),
              ).then((value) {
                // Return value indicates success, could trigger refresh
              });
            },
            icon: const Icon(Icons.edit_document),
            label: const Text('Completar tareas'),
          ),
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
          const Text('Accedé a todos los documentos subidos y generados durante este trámite.'),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => RepositoryScreen(procedure: widget.procedure),
                ),
              );
            },
            icon: const Icon(Icons.open_in_new_outlined),
            label: const Text('Abrir repositorio'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF7C4A20),
            ),
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
