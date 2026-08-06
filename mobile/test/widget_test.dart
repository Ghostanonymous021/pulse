import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pulse_app/app.dart';

void main() {
  testWidgets('PulseApp boots login shell', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: PulseApp()));
    expect(find.text('Pulse'), findsOneWidget);
  });
}
