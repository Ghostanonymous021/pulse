import 'package:flutter_test/flutter_test.dart';
import 'package:pulse_app/features/feed/data/feed_models.dart';

void main() {
  test('FeedPage parses posts and nextOffset', () {
    final page = FeedPage.fromJson({
      'posts': [
        {
          'id': 'p1',
          'author_id': 'a1',
          'body': 'Olá',
          'created_at': '2026-08-01T12:00:00.000Z',
          'is_highlighted': false,
          'author': {'id': 'a1', 'username': 'ana', 'display_name': 'Ana'},
          'like_count': 3,
          'comment_count': 1,
          'liked_by_me': true,
        },
      ],
      'nextOffset': 15,
    });
    expect(page.posts, hasLength(1));
    expect(page.nextOffset, 15);
    expect(page.posts.first.body, 'Olá');
    expect(page.posts.first.author?.username, 'ana');
    expect(page.posts.first.likeCount, 3);
    expect(page.posts.first.likedByMe, isTrue);
  });

  test('FeedPost tolerates likes aggregate list shape', () {
    final post = FeedPost.fromJson({
      'id': 'p2',
      'author_id': 'a2',
      'created_at': '2026-08-01T12:00:00.000Z',
      'likes': [{'count': 9}],
      'comments': [{'count': 2}],
    });
    expect(post.likeCount, 9);
    expect(post.commentCount, 2);
  });
}
