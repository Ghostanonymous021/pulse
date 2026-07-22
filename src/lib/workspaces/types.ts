export type ProjectVisibility = "public" | "private" | "unlisted";
export type ProjectRole = "owner" | "admin" | "member";
export type ProjectEntryType = "text" | "file" | "link" | "image";

export type ProjectMemberWithUser = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
};

export type WorkspaceEntryWithAuthor = {
  id: string;
  project_id: string;
  author_id: string;
  entry_type: ProjectEntryType;
  body: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  url: string | null;
  link_preview_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  link_preview: {
    titulo: string | null;
    imagem_url: string | null;
    dominio: string | null;
  } | null;
  /** Signed storage URL (server-side). */
  file_url: string | null;
};

export type WorkspaceStarWithUser = {
  project_id: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type WorkspaceInviteWithProject = {
  id: string;
  project_id: string;
  invited_by: string;
  invitee_id: string;
  status: "pending" | "accepted" | "rejected";
  expires_at: string;
  created_at: string;
  project: {
    id: string;
    name: string;
  } | null;
};

export type WorkspaceWithMeta = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  link: string | null;
  repo_url: string | null;
  image_url: string | null;
  position: number;
  visibility: ProjectVisibility;
  type: string;
  settings: Record<string, unknown> | null;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
  members_count: number;
  entries_count: number;
  stars_count: number;
  viewer_role: ProjectRole | null;
  viewer_starred: boolean;
};

export type CreateWorkspaceInput = {
  name: string;
  description?: string | null;
  visibility: ProjectVisibility;
  inviteeUsernames?: string[];
};

export type CreateEntryInput = {
  projectId: string;
  entryType: ProjectEntryType;
  body?: string | null;
  url?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};
