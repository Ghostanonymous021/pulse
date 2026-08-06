class FeedPage {
  const FeedPage({required this.posts, required this.nextOffset});
  final List<FeedPost> posts;
  final int? nextOffset;

  factory FeedPage.fromJson(Map<String, dynamic> json) {
    final raw = json['posts'];
    final posts = <FeedPost>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map<String, dynamic>) posts.add(FeedPost.fromJson(item));
      }
    }
    final next = json['nextOffset'];
    return FeedPage(posts: posts, nextOffset: next is int ? next : null);
  }
}

class FeedPost {
  const FeedPost({
    required this.id,
    required this.authorId,
    required this.createdAt,
    this.body,
    this.isHighlighted = false,
    this.expiresAt,
    this.author,
    this.likeCount = 0,
    this.commentCount = 0,
    this.likedByMe = false,
  });

  final String id;
  final String authorId;
  final String? body;
  final bool isHighlighted;
  final DateTime? expiresAt;
  final DateTime createdAt;
  final FeedAuthor? author;
  final int likeCount;
  final int commentCount;
  final bool likedByMe;

  factory FeedPost.fromJson(Map<String, dynamic> json) {
    return FeedPost(
      id: json['id'] as String,
      authorId: (json['author_id'] ?? json['authorId']) as String,
      body: json['body'] as String?,
      isHighlighted: json['is_highlighted'] as bool? ?? false,
      expiresAt: _parseDate(json['expires_at']),
      createdAt: _parseDate(json['created_at']) ?? DateTime.fromMillisecondsSinceEpoch(0),
      author: json['author'] is Map<String, dynamic>
          ? FeedAuthor.fromJson(json['author'] as Map<String, dynamic>)
          : null,
      likeCount: _readCount(json, const ['like_count', 'likes_count', 'likes']),
      commentCount: _readCount(json, const ['comment_count', 'comments_count', 'comments']),
      likedByMe: json['liked_by_me'] as bool? ?? false,
    );
  }
}

class FeedAuthor {
  const FeedAuthor({
    required this.id,
    this.username,
    this.displayName,
    this.avatarUrl,
    this.accountType,
  });

  final String id;
  final String? username;
  final String? displayName;
  final String? avatarUrl;
  final String? accountType;

  factory FeedAuthor.fromJson(Map<String, dynamic> json) {
    return FeedAuthor(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: (json['display_name'] ?? json['displayName']) as String?,
      avatarUrl: (json['avatar_url'] ?? json['avatarUrl']) as String?,
      accountType: (json['account_type'] ?? json['accountType']) as String?,
    );
  }
}

DateTime? _parseDate(Object? value) {
  if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
  return null;
}

int _readCount(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final v = json[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is List) {
      if (v.isEmpty) return 0;
      final first = v.first;
      if (first is Map && first['count'] is num) return (first['count'] as num).toInt();
      return v.length;
    }
    if (v is Map && v['count'] is num) return (v['count'] as num).toInt();
  }
  return 0;
}
