import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/config/env.dart';
import 'feed_models.dart';

class FeedRepository {
  FeedRepository({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  Future<FeedPage> fetchPage({
    required String accessToken,
    int offset = 0,
    int limit = 15,
    String scope = 'all',
    String? authorId,
  }) async {
    final base = Env.bffBaseUrl;
    if (base.isEmpty) throw StateError('BFF_BASE_URL is not configured');

    final uri = Uri.parse('$base/api/feed').replace(queryParameters: {
      'offset': '$offset',
      'limit': '$limit',
      'scope': scope,
      if (authorId != null && authorId.isNotEmpty) 'authorId': authorId,
    });

    final response = await _client.get(uri, headers: {
      'Authorization': 'Bearer $accessToken',
      'Accept': 'application/json',
    });

    if (response.statusCode == 401) throw FeedUnauthorizedException();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FeedException('Feed failed (${response.statusCode})');
    }
    final body = jsonDecode(response.body);
    if (body is! Map<String, dynamic>) throw FeedException('Unexpected feed payload');
    return FeedPage.fromJson(body);
  }

  Future<String?> checkLatestId({
    required String accessToken,
    String scope = 'all',
  }) async {
    final base = Env.bffBaseUrl;
    if (base.isEmpty) throw StateError('BFF_BASE_URL is not configured');
    final uri = Uri.parse('$base/api/feed/check').replace(queryParameters: {'scope': scope});
    final response = await _client.get(uri, headers: {
      'Authorization': 'Bearer $accessToken',
      'Accept': 'application/json',
    });
    if (response.statusCode == 401) throw FeedUnauthorizedException();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FeedException('Feed check failed (${response.statusCode})');
    }
    final body = jsonDecode(response.body);
    if (body is Map<String, dynamic>) return body['latestId'] as String?;
    return null;
  }
}

class FeedException implements Exception {
  FeedException(this.message);
  final String message;
  @override
  String toString() => message;
}

class FeedUnauthorizedException extends FeedException {
  FeedUnauthorizedException() : super('Não autenticado');
}
