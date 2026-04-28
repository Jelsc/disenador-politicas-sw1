import 'package:flutter/material.dart';
import 'package:signature/signature.dart';

class SignatureCaptureScreen extends StatefulWidget {
  final String title;
  final String message;

  const SignatureCaptureScreen({
    super.key,
    required this.title,
    required this.message,
  });

  @override
  State<SignatureCaptureScreen> createState() => _SignatureCaptureScreenState();
}

class _SignatureCaptureScreenState extends State<SignatureCaptureScreen> {
  final SignatureController _controller = SignatureController(
    penStrokeWidth: 4,
    penColor: const Color(0xFF1F2933),
    exportBackgroundColor: Colors.white,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_controller.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Primero dibujá tu firma.')));
      return;
    }
    final bytes = await _controller.toPngBytes();
    if (!mounted || bytes == null) return;
    Navigator.pop(context, bytes);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F1E8),
      appBar: AppBar(
        title: const Text('Firma digital'),
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(widget.message),
            const SizedBox(height: 18),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFD99B45), width: 2),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: Signature(
                    controller: _controller,
                    backgroundColor: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _controller.clear,
                    icon: const Icon(Icons.cleaning_services_outlined),
                    label: const Text('Limpiar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _confirm,
                    icon: const Icon(Icons.check),
                    label: const Text('Confirmar firma'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
