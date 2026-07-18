export type CommentAuthor = {
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

export type CommentNode = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  reply_to_username: string | null;
  created_at: string;
  author: CommentAuthor | null;
  like_count: number;
  liked_by_me: boolean;
  /** Visual children (depth 1 only after flatten). */
  replies: CommentNode[];
};

type FlatComment = Omit<CommentNode, "replies">;

/**
 * Build true tree from flat rows, then flatten visual depth beyond 1:
 * - Level 0: top-level comments
 * - Level 1: all descendants shown as siblings under the root,
 *   with reply_to_username for context when depth was > 1
 *
 * Data depth is unlimited; UI never indents past level 1.
 */
export function buildCommentTree(flat: FlatComment[]): CommentNode[] {
  const byId = new Map<string, FlatComment>();
  for (const c of flat) byId.set(c.id, c);

  // Children map for real tree walk
  const children = new Map<string, FlatComment[]>();
  const roots: FlatComment[] = [];

  for (const c of flat) {
    if (c.parent_id && byId.has(c.parent_id)) {
      const list = children.get(c.parent_id) ?? [];
      list.push(c);
      children.set(c.parent_id, list);
    } else {
      roots.push(c);
    }
  }

  function sortByTime(a: FlatComment, b: FlatComment) {
    return a.created_at.localeCompare(b.created_at);
  }

  roots.sort(sortByTime);
  for (const list of children.values()) list.sort(sortByTime);

  /**
   * Walk real descendants of a root and emit flat visual replies (depth 1).
   * For nodes deeper than 1 hop from root, keep reply_to_username from DB
   * (parent author); for direct children, clear prefix (context is structural).
   */
  function collectVisualReplies(
    rootId: string,
    parentId: string,
    depthFromRoot: number,
  ): CommentNode[] {
    const kids = children.get(parentId) ?? [];
    const out: CommentNode[] = [];
    for (const kid of kids) {
      const isDeep = depthFromRoot >= 1;
      out.push({
        ...kid,
        // Direct replies: no prefix. Nested: keep "Respondendo a @x"
        reply_to_username: isDeep
          ? kid.reply_to_username || byId.get(kid.parent_id ?? "")?.author?.username || null
          : null,
        replies: [],
      });
      // Recurse: all deeper replies become siblings under same root
      out.push(...collectVisualReplies(rootId, kid.id, depthFromRoot + 1));
    }
    return out;
  }

  return roots.map((root) => ({
    ...root,
    reply_to_username: null,
    replies: collectVisualReplies(root.id, root.id, 0),
  }));
}

/** Initial reply count shown before "Ver mais". */
export const INITIAL_REPLY_VISIBLE = 3;
