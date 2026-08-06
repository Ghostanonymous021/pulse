import 'package:flutter/material.dart';

class FeedScreen extends StatelessWidget {
  const FeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pulse')),
      body: const Center(
        child: Text(
          'Feed ranked via /api/feed\n(cache local na Fase 2)',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
