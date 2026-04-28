import 'package:flutter/material.dart';
import 'package:signature/signature.dart';
import 'dart:typed_data';
import 'package:intl/intl.dart';
import '../models/procedure_ticket.dart';

class ProcedureDetailScreen extends StatefulWidget {
  final ProcedureTicket procedure;

  const ProcedureDetailScreen({super.key, required this.procedure});

  @override
  State<ProcedureDetailScreen> createState() => _ProcedureDetailScreenState();
}

class _ProcedureDetailScreenState extends State<ProcedureDetailScreen> {
  final SignatureController _signatureController = SignatureController(
    penStrokeWidth: 4,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );

  bool _isSigning = false;
  Uint8List? _savedSignature;

  @override
  void dispose() {
    _signatureController.dispose();
    super.dispose();
  }

  Future<void> _handleSaveSignature() async {
    if (_signatureController.isNotEmpty) {
      final signatureData = await _signatureController.toPngBytes();
      if (signatureData != null) {
        setState(() {
          _savedSignature = signatureData;
          _isSigning = false;
        });
        
        // TODO: Mandar la firma al backend usando ApiService
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Firma guardada correctamente (Lista para subir al servidor)'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    }
  }

  Widget _buildStatusChip(String status) {
    Color color = status == 'COMPLETED' ? Colors.green : Colors.orange;
    String label = status == 'COMPLETED' ? 'Completado' : 'En Progreso';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.bold),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final proc = widget.procedure;

    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('Detalle del Trámite'),
        backgroundColor: const Color(0xFF7c3aed),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            proc.policyName,
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                        ),
                        _buildStatusChip(proc.status),
                      ],
                    ),
                    const Divider(height: 32),
                    
                    Text('ID del Trámite:', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text(proc.id, style: const TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(height: 12),
                    
                    if (proc.clientName != null) ...[
                      Text('Titular:', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                      Text('${proc.clientName} (CI: ${proc.clientCi})', style: const TextStyle(fontWeight: FontWeight.w500)),
                      const SizedBox(height: 12),
                    ],

                    Text('Fecha de Inicio:', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text(DateFormat('dd/MM/yyyy HH:mm').format(proc.createdAt), style: const TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(height: 12),

                    if (proc.progressPercentage > 0) ...[
                      Text('Progreso: ${proc.progressPercentage}%', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: LinearProgressIndicator(
                          value: proc.progressPercentage / 100,
                          backgroundColor: Colors.grey[200],
                          valueColor: AlwaysStoppedAnimation(
                            proc.status == 'COMPLETED' ? Colors.green : const Color(0xFF7c3aed),
                          ),
                          minHeight: 10,
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    if (proc.currentDepartments.isNotEmpty) ...[
                      Text('En Análisis por:', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                      Text(proc.currentDepartments.join(', '), style: const TextStyle(fontWeight: FontWeight.w500)),
                      const SizedBox(height: 12),
                    ],

                    if (proc.finalObservation != null && proc.finalObservation!.isNotEmpty) ...[
                      const Divider(height: 32),
                      Text('Resolución / Observaciones Finales:', style: TextStyle(color: Colors.green[700], fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(proc.finalObservation!, style: const TextStyle(fontSize: 14)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Sección de Firma Digital
            if (_savedSignature != null) ...[
              const Text('Firma Digital (Registrada)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.all(8),
                child: Image.memory(_savedSignature!, height: 120),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => setState(() {
                  _savedSignature = null;
                  _isSigning = true;
                  _signatureController.clear();
                }),
                icon: const Icon(Icons.refresh),
                label: const Text('Volver a firmar'),
                style: ElevatedButton.styleFrom(
                  foregroundColor: const Color(0xFF7c3aed),
                  backgroundColor: Colors.white,
                ),
              )
            ] else if (_isSigning) ...[
              const Text('Dibuja tu firma abajo:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFF7c3aed), width: 2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Signature(
                    controller: _signatureController,
                    height: 200,
                    backgroundColor: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton.icon(
                    onPressed: () => _signatureController.clear(),
                    icon: const Icon(Icons.clear, color: Colors.red),
                    label: const Text('Limpiar', style: TextStyle(color: Colors.red)),
                  ),
                  ElevatedButton.icon(
                    onPressed: _handleSaveSignature,
                    icon: const Icon(Icons.check),
                    label: const Text('Guardar Firma'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7c3aed),
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ] else ...[
              ElevatedButton.icon(
                onPressed: () => setState(() => _isSigning = true),
                icon: const Icon(Icons.draw),
                label: const Text('Añadir Firma Digital (Touch)'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFF7c3aed),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}