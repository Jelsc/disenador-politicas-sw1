import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/procedure_ticket.dart';
import '../services/api_service.dart';
import 'signature_capture_screen.dart';

class ClientTaskScreen extends StatefulWidget {
  final ProcedureTicket procedure;
  final ProcedureClientTask task;
  final ApiService? apiService;

  const ClientTaskScreen({
    super.key,
    required this.procedure,
    required this.task,
    this.apiService,
  });

  @override
  State<ClientTaskScreen> createState() => _ClientTaskScreenState();
}

class _ClientTaskScreenState extends State<ClientTaskScreen> {
  final Map<String, dynamic> _formValues = {};
  bool _isSubmitting = false;

  ApiService get _api => widget.apiService ?? ApiService();

  String _fieldType(ClientTaskField field) => field.type.toUpperCase();

  bool _isValueFilled(dynamic value) {
    if (value == null) return false;
    if (value is String) return value.trim().isNotEmpty;
    if (value is bool) return value;
    if (value is Iterable) return value.isNotEmpty;
    return value.toString().trim().isNotEmpty;
  }

  List<String> _optionsFor(ClientTaskField field) => field.options ?? const [];

  void _toggleMultiValue(String fieldId, String option, bool checked) {
    final current = List<String>.from(_formValues[fieldId] as List? ?? const []);
    if (checked) {
      if (!current.contains(option)) current.add(option);
    } else {
      current.remove(option);
    }
    _formValues[fieldId] = current;
  }

  Future<void> _submitForm() async {
    // Validate required
    for (final field in widget.task.fields) {
      if (field.required) {
        final val = _formValues[field.id];
        if (!_isValueFilled(val)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('El campo "${field.label}" es obligatorio.'),
              backgroundColor: Colors.red,
            ),
          );
          return;
        }
      }
    }

    setState(() => _isSubmitting = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    if (token == null) {
      setState(() => _isSubmitting = false);
      return;
    }

    // Call submit API
    final success = await _api.completeProcedureTask(
      token,
      widget.task.id,
      _formValues,
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tarea completada exitosamente.'),
          backgroundColor: Color(0xFF166534),
        ),
      );
      Navigator.pop(context, true); // Returns true to refresh previous screen
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Error al completar la tarea.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _pickFile(ClientTaskField field) async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    if (result != null && result.files.isNotEmpty) {
      final file = result.files.first;
      if (file.bytes != null) {
        setState(() => _isSubmitting = true);
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('token');

        if (token != null) {
          final response = await _api.uploadTaskDocument(
            token: token,
            procedureId: widget.procedure.id,
            taskId: widget.task.id,
            fieldId: field.id,
            fileName: file.name,
            bytes: file.bytes!,
          );
          if (response['success'] == false) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(response['message']?.toString() ?? 'Error al subir el archivo.'),
                  backgroundColor: Colors.red,
                ),
              );
            }
          } else {
            setState(() {
              _formValues[field.id] = response;
            });
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Archivo subido correctamente.'),
                  backgroundColor: Color(0xFF166534),
                ),
              );
            }
          }
        }
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _captureSignature(ClientTaskField field) async {
    final bytes = await Navigator.push<dynamic>(
      context,
      MaterialPageRoute(
        builder: (_) => SignatureCaptureScreen(
          title: field.label,
          message: field.placeholder ?? 'Firme a continuación',
        ),
      ),
    );

    if (bytes != null) {
      setState(() => _isSubmitting = true);
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');

      if (token != null) {
        final success = await _api.submitClientSignature(
          token: token,
          procedureId: widget.procedure.id,
          taskId: widget.task.id,
          fieldId: field.id,
          imageBase64: base64Encode(bytes),
        );
        if (success) {
          setState(() {
            _formValues[field.id] = '[FIRMADA]';
          });
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Firma registrada correctamente.'),
                backgroundColor: Color(0xFF166534),
              ),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Error al enviar la firma.'),
                backgroundColor: Colors.red,
              ),
            );
          }
        }
      }
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F1E8),
      appBar: AppBar(
        title: Text(widget.task.label),
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
        elevation: 0,
      ),
      body: _isSubmitting
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Completá los campos requeridos para esta tarea.',
                  style: TextStyle(fontSize: 16, color: Color(0xFF7B7063)),
                ),
                const SizedBox(height: 24),
                ...widget.task.fields.map(_buildField),
                const SizedBox(height: 32),
                FilledButton(
                  onPressed: _submitForm,
                  child: const Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Text('Finalizar Tarea', style: TextStyle(fontSize: 16)),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildField(ClientTaskField field) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                field.label,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              if (field.required)
                const Text(' *', style: TextStyle(color: Colors.red)),
            ],
          ),
          const SizedBox(height: 8),
          _buildFieldInput(field),
        ],
      ),
    );
  }

  Widget _buildFieldInput(ClientTaskField field) {
    final type = _fieldType(field);

    if (type == 'FILE') {
      final value = _formValues[field.id];
      final label = _uploadedFileLabel(value);
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE3D8C5)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(Icons.upload_file, size: 40, color: value != null ? const Color(0xFF166534) : const Color(0xFFB45309)),
            const SizedBox(height: 8),
            Text(value != null ? 'Archivo subido: $label' : 'Adjuntar archivo'),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => _pickFile(field),
              child: Text(value != null ? 'Cambiar archivo' : 'Seleccionar archivo'),
            ),
          ],
        ),
      );
    }

    if (type == 'SIGNATURE') {
      final value = _formValues[field.id];
      final signed = value == '[FIRMADA]';
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE3D8C5)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(Icons.draw, size: 40, color: signed ? const Color(0xFF166534) : const Color(0xFF92400E)),
            const SizedBox(height: 8),
            Text(signed ? 'Firma completada' : 'Firma requerida'),
            const SizedBox(height: 12),
            if (!signed)
              FilledButton.icon(
                onPressed: () => _captureSignature(field),
                icon: const Icon(Icons.edit),
                label: const Text('Firmar con el dedo'),
              ),
          ],
        ),
      );
    }

    if (type == 'TABLE') {
      final columns = field.tableColumns != null && field.tableColumns!.isNotEmpty
          ? field.tableColumns!
          : ['Dato'];
      final fixedRows = field.matrixRows != null && field.matrixRows!.isNotEmpty
          ? field.matrixRows!
          : ['Fila 1'];

      return StatefulBuilder(
        builder: (context, setStateLocal) {
          if (_formValues[field.id] == null) {
            _formValues[field.id] = fixedRows.map((r) => <String, dynamic>{columns[0]: ''}).toList();
          }

          final List<dynamic> rows = _formValues[field.id] as List<dynamic>;

          return Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE3D8C5)),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: [
                      const DataColumn(label: Text('')),
                      ...columns.map((col) => DataColumn(label: Text(col, style: const TextStyle(fontWeight: FontWeight.bold)))),
                    ],
                    rows: rows.asMap().entries.map((entry) {
                      final i = entry.key;
                      final rowData = entry.value as Map<String, dynamic>;
                      return DataRow(
                        cells: [
                          DataCell(Text(fixedRows[i], style: const TextStyle(fontWeight: FontWeight.bold))),
                          ...columns.map((colName) {
                            return DataCell(
                              TextFormField(
                                initialValue: rowData[colName]?.toString(),
                                onChanged: (val) {
                                  rowData[colName] = val;
                                  _formValues[field.id] = rows;
                                },
                                decoration: const InputDecoration(border: InputBorder.none, isDense: true),
                              ),
                            );
                          }),
                        ],
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          );
        },
      );
    }

    if (type == 'SINGLE_CHOICE' || type == 'CHECKBOX') {
      final options = _optionsFor(field);
      final currentValue = _formValues[field.id] as String?;

      if (options.isEmpty) {
        return const Text('No hay opciones configuradas para este campo.');
      }

      if (type == 'CHECKBOX') {
        final label = options.isNotEmpty ? options.first : field.label;
        final checked = _formValues[field.id] == true;

        return CheckboxListTile(
          value: checked,
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: Text(label),
          onChanged: (value) {
            setState(() {
              _formValues[field.id] = value ?? false;
            });
          },
        );
      }

      return DropdownButtonFormField<String>(
        initialValue: options.contains(currentValue) ? currentValue : null,
        decoration: InputDecoration(
          hintText: field.placeholder ?? 'Seleccioná una opción',
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE3D8C5)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE3D8C5)),
          ),
        ),
        items: options
            .map((option) => DropdownMenuItem<String>(value: option, child: Text(option)))
            .toList(),
        onChanged: (value) {
          setState(() {
            _formValues[field.id] = value;
          });
        },
      );
    }

    if (type == 'MULTIPLE_CHOICE' || type == 'CHECKLIST') {
      final options = _optionsFor(field);

      if (options.isEmpty) {
        return const Text('No hay opciones configuradas para este campo.');
      }

      return StatefulBuilder(
        builder: (context, setStateLocal) {
          final selected = List<String>.from(_formValues[field.id] as List? ?? const []);

          return Column(
            children: options.map((option) {
              final checked = selected.contains(option);
              return CheckboxListTile(
                value: checked,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: Text(option),
                onChanged: (value) {
                  setStateLocal(() {
                    _toggleMultiValue(field.id, option, value ?? false);
                  });
                  setState(() {});
                },
              );
            }).toList(),
          );
        },
      );
    }

    return TextFormField(
      initialValue: _formValues[field.id]?.toString(),
      onChanged: (val) {
        _formValues[field.id] = val;
      },
      maxLines: type == 'LONG_TEXT' ? 4 : 1,
      decoration: InputDecoration(
        hintText: field.placeholder,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE3D8C5)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE3D8C5)),
        ),
      ),
    );
  }

  String _uploadedFileLabel(dynamic value) {
    if (value is Map<String, dynamic>) {
      final candidates = [value['fileName'], value['originalName'], value['name']];
      for (final candidate in candidates) {
        final text = candidate?.toString().trim() ?? '';
        if (text.isNotEmpty) {
          return text;
        }
      }
    }

    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    return 'Archivo subido';
  }
}
