/**
 * Hand-maintained types aligned with docs/SCHEMA.md and supabase/migrations.
 * Replace with `supabase gen types typescript` when CLI is available.
 */

export type AccountType = "pessoa" | "organizacao";
export type FollowStatus = "pending" | "accepted";
export type ReportTargetType = "post" | "profile" | "message";
export type ReportStatus = "open" | "reviewed" | "actioned";
export type DmPermission = "everyone" | "following" | "none";
export type ProfessionalOrgType =
  | "universidade"
  | "instituicao"
  | "empresa"
  | "clube"
  | "outro";
export type ProfessionalRequestStatus = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  phone: string | null;
  email: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  account_type: AccountType;
  university: string | null;
  campus: string | null;
  course: string | null;
  year: string | null;
  is_private: boolean;
  /** Present after settings migration; default everyone. */
  dm_permission?: DmPermission;
  /** Paid verification seal (optional). Never used in feed ranking. */
  is_verified?: boolean;
  /** Seal flavour at activation; badge uses this when set, else account_type. */
  verified_type?: AccountType | null;
  verified_at?: string | null;
  verification_expires_at?: string | null;
  priority_support?: boolean;
  early_access?: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  new_followers: boolean;
  likes: boolean;
  comments: boolean;
  messages: boolean;
  mentions: boolean;
  updated_at: string;
};

export type Block = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  body: string | null;
  is_highlighted: boolean;
  highlighted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PostMedia = {
  id: string;
  post_id: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  position: number;
  created_at: string;
};

export type Follow = {
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
};

export type Like = {
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  /** Parent comment author username (for visual flatten prefix). */
  reply_to_username?: string | null;
  created_at: string;
};

export type ProfileLink = {
  id: string;
  profile_id: string;
  rotulo: string;
  url: string;
  ordem: number;
  created_at: string;
};

export type LinkPreview = {
  id: string;
  post_id: string;
  url: string;
  titulo: string | null;
  imagem_url: string | null;
  dominio: string | null;
  fetched_at: string;
};

export type NotificationType =
  | "novo_seguidor"
  | "curtida"
  | "comentario"
  | "mensagem"
  | "mencao"
  | "aprovacao_modo_profissional"
  | "aprovacao_verificacao";

export type Notification = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  actor_id: string | null;
  reference_id: string | null;
  actor_ids: string[];
  actor_count: number;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  link: string | null;
  repo_url: string | null;
  image_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

type Tables = {
  profiles: {
    Row: Profile;
    Insert: {
      id: string;
      phone?: string | null;
      email?: string | null;
      username: string;
      display_name?: string;
      avatar_url?: string | null;
      bio?: string | null;
      account_type?: AccountType;
      university?: string | null;
      campus?: string | null;
      course?: string | null;
      year?: string | null;
      is_private?: boolean;
      dm_permission?: DmPermission;
    };
    Update: Partial<Profile>;
    Relationships: [];
  };
  notification_preferences: {
    Row: NotificationPreferences;
    Insert: {
      user_id: string;
      new_followers?: boolean;
      likes?: boolean;
      comments?: boolean;
      messages?: boolean;
      mentions?: boolean;
    };
    Update: Partial<
      Omit<NotificationPreferences, "user_id">
    >;
    Relationships: [];
  };
  blocks: {
    Row: Block;
    Insert: {
      blocker_id: string;
      blocked_id: string;
    };
    Update: Partial<Block>;
    Relationships: [];
  };
  professional_requests: {
    Row: {
      id: string;
      profile_id: string;
      nome_organizacao: string;
      tipo_organizacao: ProfessionalOrgType;
      tipo_detalhe: string | null;
      descricao: string;
      contacto: string;
      status: ProfessionalRequestStatus;
      created_at: string;
      reviewed_at: string | null;
    };
    Insert: {
      id?: string;
      profile_id: string;
      nome_organizacao: string;
      tipo_organizacao: ProfessionalOrgType;
      tipo_detalhe?: string | null;
      descricao: string;
      contacto: string;
      status?: ProfessionalRequestStatus;
      reviewed_at?: string | null;
    };
    Update: Partial<{
      status: ProfessionalRequestStatus;
      reviewed_at: string | null;
    }>;
    Relationships: [];
  };
  verification_requests: {
    Row: {
      id: string;
      profile_id: string;
      account_type: AccountType;
      status:
        | "draft"
        | "pending_payment"
        | "pending_review"
        | "active"
        | "rejected"
        | "expired"
        | "cancelled";
      id_document_path: string | null;
      selfie_path: string | null;
      org_document_path: string | null;
      org_email_domain: string | null;
      admin_notes: string | null;
      created_at: string;
      updated_at: string;
      reviewed_at: string | null;
      activated_at: string | null;
    };
    Insert: {
      id?: string;
      profile_id: string;
      account_type: AccountType;
      status?:
        | "draft"
        | "pending_payment"
        | "pending_review"
        | "active"
        | "rejected"
        | "expired"
        | "cancelled";
      id_document_path?: string | null;
      selfie_path?: string | null;
      org_document_path?: string | null;
      org_email_domain?: string | null;
    };
    Update: Partial<{
      status:
        | "draft"
        | "pending_payment"
        | "pending_review"
        | "active"
        | "rejected"
        | "expired"
        | "cancelled";
      id_document_path: string | null;
      selfie_path: string | null;
      org_document_path: string | null;
      org_email_domain: string | null;
      admin_notes: string | null;
      reviewed_at: string | null;
      activated_at: string | null;
      updated_at: string;
    }>;
    Relationships: [];
  };
  verification_payments: {
    Row: {
      id: string;
      request_id: string;
      profile_id: string;
      amount_mzn: number;
      currency: string;
      is_first_month: boolean;
      provider: string;
      provider_ref: string | null;
      status: "pending" | "simulated" | "paid" | "failed" | "refunded";
      period_start: string | null;
      period_end: string | null;
      created_at: string;
      paid_at: string | null;
    };
    Insert: {
      id?: string;
      request_id: string;
      profile_id: string;
      amount_mzn: number;
      currency?: string;
      is_first_month?: boolean;
      provider?: string;
      provider_ref?: string | null;
      status?: "pending" | "simulated" | "paid" | "failed" | "refunded";
      period_start?: string | null;
      period_end?: string | null;
      paid_at?: string | null;
    };
    Update: Partial<{
      status: "pending" | "simulated" | "paid" | "failed" | "refunded";
      provider_ref: string | null;
      paid_at: string | null;
    }>;
    Relationships: [];
  };
  posts: {
    Row: Post;
    Insert: {
      id?: string;
      author_id: string;
      body?: string | null;
      is_highlighted?: boolean;
      highlighted_at?: string | null;
    };
    Update: Partial<Post>;
    Relationships: [];
  };
  post_media: {
    Row: PostMedia;
    Insert: {
      id?: string;
      post_id: string;
      storage_path: string;
      mime_type: string;
      width?: number | null;
      height?: number | null;
      position?: number;
    };
    Update: Partial<PostMedia>;
    Relationships: [];
  };
  follows: {
    Row: Follow;
    Insert: {
      follower_id: string;
      following_id: string;
      status?: FollowStatus;
    };
    Update: Partial<Follow>;
    Relationships: [];
  };
  likes: {
    Row: Like;
    Insert: {
      user_id: string;
      post_id: string;
    };
    Update: Partial<Like>;
    Relationships: [];
  };
  comments: {
    Row: Comment;
    Insert: {
      id?: string;
      post_id: string;
      author_id: string;
      body: string;
      parent_id?: string | null;
      reply_to_username?: string | null;
    };
    Update: Partial<Comment>;
    Relationships: [];
  };
  profile_links: {
    Row: ProfileLink;
    Insert: {
      id?: string;
      profile_id: string;
      rotulo: string;
      url: string;
      ordem?: number;
    };
    Update: Partial<Omit<ProfileLink, "id" | "profile_id" | "created_at">>;
    Relationships: [];
  };
  link_previews: {
    Row: LinkPreview;
    Insert: {
      id?: string;
      post_id: string;
      url: string;
      titulo?: string | null;
      imagem_url?: string | null;
      dominio?: string | null;
      fetched_at?: string;
    };
    Update: Partial<Omit<LinkPreview, "id" | "post_id">>;
    Relationships: [];
  };
  notifications: {
    Row: Notification;
    Insert: {
      id?: string;
      recipient_id: string;
      type: NotificationType;
      actor_id?: string | null;
      reference_id?: string | null;
      actor_ids?: string[];
      actor_count?: number;
      is_read?: boolean;
    };
    Update: Partial<Pick<Notification, "is_read" | "updated_at">>;
    Relationships: [];
  };
  profile_admins: {
    Row: {
      profile_id: string;
      admin_user_id: string;
      role: "owner" | "admin";
      created_at: string;
    };
    Insert: {
      profile_id: string;
      admin_user_id: string;
      role?: "owner" | "admin";
    };
    Update: Partial<{ role: "owner" | "admin" }>;
    Relationships: [];
  };
  profile_stats: {
    Row: {
      profile_id: string;
      profile_views: number;
      post_reach: number;
      updated_at: string;
    };
    Insert: {
      profile_id: string;
      profile_views?: number;
      post_reach?: number;
    };
    Update: Partial<{
      profile_views: number;
      post_reach: number;
      updated_at: string;
    }>;
    Relationships: [];
  };
  comment_likes: {
    Row: {
      user_id: string;
      comment_id: string;
      created_at: string;
    };
    Insert: {
      user_id: string;
      comment_id: string;
    };
    Update: Partial<{ user_id: string; comment_id: string }>;
    Relationships: [];
  };
  reports: {
    Row: {
      id: string;
      reporter_id: string;
      target_type: ReportTargetType;
      target_id: string;
      reason: string;
      status: ReportStatus;
      /** Set from reporter.priority_support (verified accounts). */
      is_priority?: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      reporter_id: string;
      target_type: ReportTargetType;
      target_id: string;
      reason: string;
      status?: ReportStatus;
      is_priority?: boolean;
    };
    Update: Partial<{
      reason: string;
      status: ReportStatus;
      is_priority: boolean;
    }>;
    Relationships: [];
  };
  projects: {
    Row: Project;
    Insert: {
      id?: string;
      user_id: string;
      title: string;
      description?: string | null;
      link?: string | null;
      repo_url?: string | null;
      image_url?: string | null;
      position?: number;
    };
    Update: Partial<Project>;
    Relationships: [];
  };
  conversations: {
    Row: { id: string; created_at: string };
    Insert: { id?: string };
    Update: { id?: string };
    Relationships: [];
  };
  conversation_participants: {
    Row: {
      conversation_id: string;
      user_id: string;
      joined_at: string;
    };
    Insert: {
      conversation_id: string;
      user_id: string;
    };
    Update: Partial<{ conversation_id: string; user_id: string }>;
    Relationships: [];
  };
  messages: {
    Row: {
      id: string;
      conversation_id: string;
      sender_id: string;
      body: string | null;
      message_type: "text" | "image" | "document" | "sticker" | "audio";
      reply_to_id: string | null;
      deleted_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      conversation_id: string;
      sender_id: string;
      body?: string | null;
      message_type?: "text" | "image" | "document" | "sticker" | "audio";
      reply_to_id?: string | null;
      deleted_at?: string | null;
    };
    Update: Partial<{
      body: string | null;
      message_type: "text" | "image" | "document" | "sticker" | "audio";
      reply_to_id: string | null;
      deleted_at: string | null;
    }>;
    Relationships: [];
  };
  message_attachments: {
    Row: {
      id: string;
      message_id: string;
      storage_path: string;
      mime_type: string;
      file_name: string | null;
      size_bytes: number | null;
      kind: "image" | "document" | "sticker" | "audio";
      created_at: string;
    };
    Insert: {
      id?: string;
      message_id: string;
      storage_path: string;
      mime_type: string;
      file_name?: string | null;
      size_bytes?: number | null;
      kind: "image" | "document" | "sticker" | "audio";
    };
    Update: Partial<{
      storage_path: string;
      mime_type: string;
      file_name: string | null;
      size_bytes: number | null;
      kind: "image" | "document" | "sticker" | "audio";
    }>;
    Relationships: [];
  };
  message_reactions: {
    Row: {
      message_id: string;
      user_id: string;
      emoji: string;
      created_at: string;
    };
    Insert: {
      message_id: string;
      user_id: string;
      emoji: string;
    };
    Update: Partial<{ emoji: string }>;
    Relationships: [];
  };
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      can_view_post: {
        Args: { p_author_id: string; p_is_private: boolean };
        Returns: boolean;
      };
      highlight_weekly_limit: {
        Args: Record<string, never>;
        Returns: number;
      };
      highlight_weekly_limit_for: {
        Args: { p_org_id: string };
        Returns: number;
      };
      activate_verification: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      check_username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
      increment_profile_view: {
        Args: { p_profile_id: string };
        Returns: undefined;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_or_create_dm: {
        Args: { other_id: string };
        Returns: string;
      };
    };
    Enums: {
      account_type: AccountType;
      follow_status: FollowStatus;
      report_target_type: ReportTargetType;
      report_status: ReportStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
