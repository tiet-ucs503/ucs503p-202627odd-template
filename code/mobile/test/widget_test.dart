import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('ClassPulse smoke test - verifies Login Screen on startup', (WidgetTester tester) async {
    await tester.pumpWidget(const ClassPulseApp());
    expect(find.text('Sign in to your account'), findsOneWidget);
  });
}
