# Pulse — Flutter client

See `docs/MOBILE_ARCHITECTURE.md` and `docs/MOBILE_API.md`.

```bash
cd mobile
flutter pub get
flutter test
flutter analyze
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  --dart-define=BFF_BASE_URL=https://YOUR_DEPLOYMENT
```

**Phase 0:** shell, theme, router, feed DTOs/repos, docs. Not store-ready.
