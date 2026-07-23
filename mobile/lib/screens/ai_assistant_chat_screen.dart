import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:record/record.dart';

import '../services/api_service.dart';

class AiAssistantChatScreen extends StatefulWidget {
  final ApiService apiService;

  const AiAssistantChatScreen({super.key, required this.apiService});

  @override
  State<AiAssistantChatScreen> createState() => _AiAssistantChatScreenState();
}

class _AiAssistantChatScreenState extends State<AiAssistantChatScreen> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _loading = false;
  bool _initialized = false;
  
  final _audioRecorder = AudioRecorder();
  bool _isRecording = false;

  ApiService get _api => widget.apiService;

  @override
  void initState() {
    super.initState();
    _initChat();
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  Future<void> _initChat() async {
    final token = await _token();
    if (token == null || !mounted) return;

    setState(() => _loading = true);

    // Send initial greeting ask
    final result = await _api.askAiAssistant(
      token: token,
      message: 'Hola, necesito ayuda con un trámite.',
    );

    if (!mounted) return;
    setState(() {
      _loading = false;
      _initialized = true;
    });

    _addBotMessage(result['answer']?.toString() ?? 
        '¡Hola! Soy el asistente virtual. Decime qué problema tenés y te ayudo a encontrar el trámite correcto.');
  }

  void _addBotMessage(String text) {
    setState(() {
      _messages.add(ChatMessage(text: text, isBot: true));
    });
    _scrollToBottom();
  }

  void _addUserMessage(String text) {
    setState(() {
      _messages.add(ChatMessage(text: text, isBot: false));
    });
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _loading) return;

    _inputController.clear();
    _addUserMessage(text);

    final token = await _token();
    if (token == null || !mounted) return;

    setState(() => _loading = true);

    try {
      final result = await _api.askAiAssistant(
        token: token,
        message: text,
      );

      if (!mounted) return;

      final answer = result['answer']?.toString() ?? 
          'No entendí bien. ¿Podés contarme más sobre tu situación?';

      _addBotMessage(answer);

      // If AI suggested a policy, show create ticket button
      final suggested = result['suggestedPolicy'];
      if (suggested is Map<String, dynamic> && suggested['policyId'] != null) {
        final policyId = suggested['policyId'].toString();
        final policyName = suggested['policyName']?.toString() ?? 'este trámite';

        final confirmMsg = '¿Querés que iniciemos el trámite **$policyName**?';
        _addBotMessage(confirmMsg);

        setState(() {
          _messages.add(ChatMessage(
            text: policyName,
            isBot: false,
            isAction: true,
            actionData: ActionData(
              type: 'confirm_ticket',
              policyId: policyId,
              policyName: policyName,
            ),
          ));
        });
      } else {
        // Show list of available policies
        final policies = result['policies'];
        if (policies is List && policies.isNotEmpty) {
          final policyLines = policies.map((p) {
            final name = p['name']?.toString() ?? 'Trámite';
            final desc = p['description']?.toString() ?? '';
            return '• **$name**${desc.isNotEmpty ? ': $desc' : ''}';
          }).join('\n');

          _addBotMessage('Estos son los trámites disponibles:\n\n$policyLines');
        }
      }
    } catch (e) {
      if (!mounted) return;
      _addBotMessage('Hubo un error de conexión. ¿Podés intentar de nuevo?');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _startRecording() async {
    if (_loading || _isRecording) return;

    try {
      if (await _audioRecorder.hasPermission()) {
        setState(() => _isRecording = true);
        final tempDir = Directory.systemTemp;
        final path = '${tempDir.path}/audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
        await _audioRecorder.start(
          const RecordConfig(encoder: AudioEncoder.aacLc, numChannels: 1),
          path: path,
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo acceder al micrófono')),
      );
    }
  }

  Future<void> _toggleRecording() async {
    if (_loading) return;
    if (_isRecording) {
      await _stopRecordingAndSend();
      return;
    }
    await _startRecording();
  }

  Future<void> _stopRecordingAndSend() async {
    if (!_isRecording) return;
    
    setState(() => _isRecording = false);
    try {
      final path = await _audioRecorder.stop();
      if (path != null) {
        final file = File(path);
        if (!await file.exists()) {
          return;
        }

        final bytes = await file.readAsBytes();
        try {
          await file.delete();
        } catch (_) {}

        if (bytes.isNotEmpty) {
          final base64Audio = base64Encode(bytes);
          _addUserMessage("🎤 (Audio)");
          _sendAudio(base64Audio);
        }
      }
    } catch (e) {
      // Handle error
    }
  }

  Future<void> _sendAudio(String audioBase64) async {
    final token = await _token();
    if (token == null || !mounted) return;

    setState(() => _loading = true);

    try {
      final result = await _api.askAiAssistant(
        token: token,
        audioBase64: audioBase64,
      );

      if (!mounted) return;

      final answer = result['answer']?.toString() ?? 'No entendí el audio.';
      final transcript = result['transcript']?.toString();
      
      if (transcript != null && transcript.isNotEmpty) {
        // optionally update the "(Audio)" message to show what was heard
      }
      
      _addBotMessage(answer);

      // Card logic
      final suggested = result['suggestedPolicyId'] ?? (result['suggestedPolicy'] is Map ? result['suggestedPolicy']['policyId'] : null);
      if (suggested != null) {
        final policyId = suggested.toString();
        // Extract policyName if available from the backend response or summary
        final policyName = 'Trámite Sugerido'; 
        
        final confirmMsg = '¿Querés que iniciemos el trámite sugerido?';
        _addBotMessage(confirmMsg);

        setState(() {
          _messages.add(ChatMessage(
            text: policyName,
            isBot: false,
            isAction: true,
            actionData: ActionData(
              type: 'confirm_ticket',
              policyId: policyId,
              policyName: policyName,
            ),
          ));
        });
      }
    } catch (e) {
      if (!mounted) return;
      _addBotMessage('Hubo un error de conexión con el audio.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmTicket(String policyId, String policyName) async {
    final token = await _token();
    if (token == null || !mounted) return;

    setState(() => _loading = true);

    try {
      final result = await _api.confirmAiTicket(
        token: token,
        policyId: policyId,
      );

      if (!mounted) return;

      if (result['success'] == true) {
        _addBotMessage('✅ ¡Listo! Iniciamos el trámite **$policyName**. Podés seguir su estado desde la pantalla principal.');
      } else {
        _addBotMessage('❌ No se pudo crear el trámite. ${result['message']?.toString() ?? 'Intentá de nuevo.'}');
      }
    } catch (e) {
      if (!mounted) return;
      _addBotMessage('❌ Error de conexión al crear el trámite.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F1E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF6F1E8),
        foregroundColor: const Color(0xFF2F2A24),
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.auto_awesome, color: Color(0xFF7c3aed)),
            SizedBox(width: 8),
            Text(
              'Asistente Virtual',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Messages
          Expanded(
            child: _initialized
                ? ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      if (msg.isAction) {
                        return _buildActionCard(msg);
                      }
                      return _buildMessageBubble(msg);
                    },
                  )
                : const Center(child: CircularProgressIndicator()),
          ),

          // Loading indicator
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: SizedBox(
                height: 16,
                width: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),

          // Input bar
          Container(
            decoration: const BoxDecoration(
              color: Color(0xFFFFFCF6),
              border: Border(
                top: BorderSide(color: Color(0xFFE3D8C5)),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      enabled: !_loading,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: InputDecoration(
                        hintText: 'Describí tu situación...',
                        filled: true,
                        fillColor: const Color(0xFFF6F1E8),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  CircleAvatar(
                    backgroundColor: _loading
                        ? Colors.grey.shade300
                        : const Color(0xFF7c3aed),
                    child: IconButton(
                      icon: const Icon(Icons.send_rounded,
                          color: Colors.white, size: 18),
                      onPressed: _loading ? null : _sendMessage,
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _toggleRecording,
                    child: CircleAvatar(
                      backgroundColor: _isRecording ? Colors.red : const Color(0xFF7c3aed),
                      child: Icon(
                        _isRecording ? Icons.mic : Icons.mic_none,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg) {
    final isUser = !msg.isBot;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            const CircleAvatar(
              radius: 14,
              backgroundColor: Color(0xFF7c3aed),
              child: Icon(Icons.auto_awesome, size: 14, color: Colors.white),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isUser
                    ? const Color(0xFF7c3aed)
                    : const Color(0xFFFFFCF6),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isUser ? 18 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 18),
                ),
                border: !isUser
                    ? Border.all(color: const Color(0xFFE3D8C5))
                    : null,
              ),
              child: Text(
                msg.text,
                style: TextStyle(
                  color: isUser ? Colors.white : const Color(0xFF2F2A24),
                  fontSize: 15,
                ),
              ),
            ),
          ),
          if (isUser) const SizedBox(width: 8),
        ],
      ),
    );
  }

  Widget _buildActionCard(ChatMessage msg) {
    final data = msg.actionData!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF3EEF9),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFC4B5E3)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.description_outlined,
                  color: Color(0xFF7c3aed), size: 28),
              const SizedBox(height: 8),
              const Text(
                '¿Iniciamos este trámite?',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF2F2A24),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                data.policyName,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.grey.shade700,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  OutlinedButton(
                    onPressed: _loading
                        ? null
                        : () {
                            setState(() {
                              _messages.remove(msg);
                            });
                          },
                    child: const Text('No, gracias'),
                  ),
                  const SizedBox(width: 12),
                  FilledButton.icon(
                    onPressed: _loading
                        ? null
                        : () => _confirmTicket(data.policyId, data.policyName),
                    icon: const Icon(Icons.check, size: 18),
                    label: const Text('Iniciar'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ChatMessage {
  final String text;
  final bool isBot;
  final bool isAction;
  final ActionData? actionData;

  ChatMessage({
    required this.text,
    required this.isBot,
    this.isAction = false,
    this.actionData,
  });
}

class ActionData {
  final String type;
  final String policyId;
  final String policyName;

  ActionData({
    required this.type,
    required this.policyId,
    required this.policyName,
  });
}
