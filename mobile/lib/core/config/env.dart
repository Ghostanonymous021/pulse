/// Inject with --dart-define (never commit secrets).
class Env {
  Env._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');
  static const bffBaseUrl = String.fromEnvironment('BFF_BASE_URL', defaultValue: '');

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty && bffBaseUrl.isNotEmpty;
}
