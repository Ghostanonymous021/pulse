import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/feed/presentation/feed_screen.dart';
import '../../features/shell/app_shell.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

GoRouter createAppRouter({required bool sessionReady}) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: sessionReady ? '/home' : '/login',
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (context, state) => const FeedScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/mensagens',
              builder: (context, state) => const Scaffold(body: Center(child: Text('Mensagens — Fase 4'))),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/postar',
              builder: (context, state) => const Scaffold(body: Center(child: Text('Publicar — Fase 3'))),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/perfil',
              builder: (context, state) => const Scaffold(body: Center(child: Text('Perfil — Fase 1+'))),
            ),
          ]),
        ],
      ),
    ],
  );
}
