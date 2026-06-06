import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/screens/login_screen.dart';

void main() {
  testWidgets('login screen renders expected entry point', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('Bienvenido'), findsOneWidget);
    expect(find.text('Iniciar Sesión'), findsOneWidget);
  });
}
