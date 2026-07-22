import type { SupabaseClient } from "@supabase/supabase-js";

import { rateLimit } from "@/lib/rate-limit";
import type {
  CreateWorkspaceInput,
  CreateEntryInput,
  ProjectMemberWithUser,
  ProjectRole,
  WorkspaceEntryWithAuthor,
  WorkspaceInviteWithProject,
  WorkspaceStarWithUser,
  WorkspaceWithMeta,
} from "@/lib/workspaces/types";

const BUCKET = "workspace-media";

export async function signedWorkspaceMediaUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresSec = 3600,
): Promise<string | null> {
  if (!storagePath) return null;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresSec);
  return data?.signedUrl ?? null;
}

const WORKSPACE_CREATE_KEY = (userId: string) => `workspace-create:${userId}`;
const WORKSPACE_CREATE_LIMIT = { limit: 5, windowMs: 24 * 60 * 60 * 1000 };

export async function createWorkspace(
  supabase: SupabaseClient,
  userId: string,
  input: CreateWorkspaceInput,
): Promise<{ data: WorkspaceWithMeta | null; error: string | null }> {
  const limit = rateLimit(WORKSPACE_CREATE_KEY(userId), WORKSPACE_CREATE_LIMIT);
  if (!limit.ok) {
    return {
      data: null,
      error: `Limite de 5 espaços por dia. Tenta novamente em ${limit.retryAfterSec}s.`,
    };
  }

  const name = input.name.trim();
  if (!name || name.length < 1 || name.length > 120) {
    return { data: null, error: "Nome deve ter entre 1 e 120 caracteres." };
  }

  const { data: workspace, error: wErr } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name,
      description: input.description?.trim() || null,
      visibility: input.visibility,
      type: "project",
    })
    .select("*")
    .single();

  if (wErr || !workspace) {
    return { data: null, error: wErr?.message || "Falha ao criar espaço." };
  }

  const existingMembers = await loadMembers(supabase, workspace.id);
  const viewerRole = existingMembers[0]?.role ?? "owner";
  const [membersCount, entriesCount, starsCount] = await Promise.all([
    supabase
      .from("project_members")
      .select("*", { count: "exact", head: true })
      .eq("project_id", workspace.id),
    supabase
      .from("project_entries")
      .select("*", { count: "exact", head: true })
      .eq("project_id", workspace.id),
    supabase
      .from("project_stars")
      .select("*", { count: "exact", head: true })
      .eq("project_id", workspace.id),
  ]);

  const data: WorkspaceWithMeta = {
    ...workspace,
    members_count: membersCount.count ?? 0,
    entries_count: entriesCount.count ?? 0,
    stars_count: starsCount.count ?? 0,
    viewer_role: viewerRole,
    viewer_starred: false,
    members: existingMembers,
  };

  if (input.inviteeUsernames?.length) {
    await inviteMembers(supabase, workspace.id, userId, input.inviteeUsernames, "member");
  }

  return { data, error: null };
}

export async function inviteMembers(
  supabase: SupabaseClient,
  projectId: string,
  invitedBy: string,
  usernames: string[],
  role: ProjectRole = "member",
): Promise<{ error: string | null }> {
  const cleanUsernames = usernames
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);

  if (!cleanUsernames.length) return { error: null };

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", cleanUsernames[0]);

  if (pErr || !profiles?.length) {
    return { error: "Utilizador não encontrado." };
  }

  const foundIds = new Set((profiles ?? []).map((p) => p.id));
  const missing = cleanUsernames.filter((u) => {
    const p = profiles.find((p) => p.username.toLowerCase() === u);
    return !p;
  });
  if (missing.length) {
    return {
      error: `Utilizador(es) não encontrado(s): ${missing.join(", ")}`,
    };
  }

  for (const pid of foundIds) {
    const { error: iErr } = await supabase
      .from("project_invites")
      .upsert(
        {
          project_id: projectId,
          invited_by: invitedBy,
          invitee_id: pid,
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "project_id,invitee_id" },
      );
    if (iErr) console.error("inviteMembers insert", iErr.message);
  }

  await supabase.rpc("notify_project_members", {
    p_project_id: projectId,
    p_actor_id: invitedBy,
  });

  return { error: null };
}

export async function acceptInvite(
  supabase: SupabaseClient,
  inviteId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { data: invite, error: rErr } = await supabase
    .from("project_invites")
    .select("*")
    .eq("id", inviteId)
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .single();

  if (rErr || !invite) {
    return { error: "Convite não encontrado ou já utilizado." };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { error: "Convite expirado." };
  }

  const { error: mErr } = await supabase
    .from("project_members")
    .upsert(
      { project_id: invite.project_id, user_id: userId, role: "member" },
      { onConflict: "project_id,user_id" },
    );

  if (mErr) return { error: mErr.message };

  const { error: uErr } = await supabase
    .from("project_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId);

  return { error: uErr?.message || null };
}

export async function removeMember(
  supabase: SupabaseClient,
  projectId: string,
  targetUserId: string,
  requesterRole: ProjectRole,
): Promise<{ error: string | null }> {
  if (requesterRole !== "owner" && requesterRole !== "admin") {
    return { error: "Sem permissão." };
  }

  const { error: dErr } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", targetUserId);

  if (dErr) return { error: dErr.message };

  const { data: targetRole } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if ((targetRole as { role: string } | null)?.role === "owner") {
    return { error: "Não podes remover o owner." };
  }

  if (requesterRole === "admin" && (targetRole as { role: string } | null)?.role === "owner") {
    return { error: "Admins não podem remover owners." };
  }

  return { error: null };
}

export async function updateMemberRole(
  supabase: SupabaseClient,
  projectId: string,
  targetUserId: string,
  newRole: ProjectRole,
  requesterRole: ProjectRole,
): Promise<{ error: string | null }> {
  if (requesterRole !== "owner") {
    return { error: "Apenas o owner pode alterar roles." };
  }
  if (newRole === "owner") {
    return { error: "Não podes atribuir owner a outro utilizador." };
  }

  const { error: uErr } = await supabase
    .from("project_members")
    .update({ role: newRole })
    .eq("project_id", projectId)
    .eq("user_id", targetUserId);

  if (uErr) return { error: uErr.message };
  return { error: null };
}

export async function createEntry(
  supabase: SupabaseClient,
  projectId: string,
  authorId: string,
  input: CreateEntryInput,
): Promise<{ data: { id: string } | null; error: string | null }> {
  if (!input.body?.trim() && !input.url?.trim() && !input.filePath) {
    return { data: null, error: "Entrada vazia." };
  }

  const { data, error } = await supabase
    .from("project_entries")
    .insert({
      project_id: projectId,
      author_id: authorId,
      entry_type: input.entryType,
      body: input.body?.trim() || null,
      url: input.url?.trim() || null,
      file_path: input.filePath || null,
      file_name: input.fileName || null,
      file_size: input.fileSize || null,
      mime_type: input.mimeType || null,
    })
    .select("id")
    .single();

  if (error) return { data: null, error: error.message };

  await supabase.rpc("notify_project_entry_created");

  return { data, error: null };
}

export async function updateEntry(
  supabase: SupabaseClient,
  entryId: string,
  projectId: string,
  userId: string,
  updates: Partial<CreateEntryInput>,
): Promise<{ error: string | null }> {
  const { data: member } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = (member as { role: string } | null)?.role;
  if (!role) return { error: "Sem permissão." };

  const { data: entry } = await supabase
    .from("project_entries")
    .select("author_id")
    .eq("id", entryId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!entry) return { error: "Entrada não encontrada." };
  if (entry.author_id !== userId && !["owner", "admin"].includes(role)) {
    return { error: "Sem permissão para editar." };
  }

  const patch: Record<string, unknown> = {};
  if (updates.body !== undefined) patch.body = updates.body?.trim() || null;
  if (updates.url !== undefined) patch.url = updates.url?.trim() || null;
  if (updates.entryType) patch.entry_type = updates.entryType;

  const { error } = await supabase
    .from("project_entries")
    .update(patch)
    .eq("id", entryId)
    .eq("project_id", projectId);

  return { error: error?.message || null };
}

export async function deleteEntry(
  supabase: SupabaseClient,
  entryId: string,
  projectId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { data: member } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = (member as { role: string } | null)?.role;
  if (!role) return { error: "Sem permissão." };

  const { data: entry } = await supabase
    .from("project_entries")
    .select("author_id")
    .eq("id", entryId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!entry) return { error: "Entrada não encontrada." };
  if (entry.author_id !== userId && !["owner", "admin"].includes(role)) {
    return { error: "Sem permissão para remover." };
  }

  const { error } = await supabase
    .from("project_entries")
    .delete()
    .eq("id", entryId)
    .eq("project_id", projectId);

  return { error: error?.message || null };
}

export async function toggleStar(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<{ starred: boolean; error: string | null }> {
  const { data: existing } = await supabase
    .from("project_stars")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("project_stars")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
    return { starred: false, error: error?.message || null };
  }

  const { error } = await supabase
    .from("project_stars")
    .insert({ project_id: projectId, user_id: userId });

  return { starred: true, error: error?.message || null };
}

export async function loadMembers(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectMemberWithUser[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select(
      `
      project_id,
      user_id,
      role,
      created_at,
      user:profiles!project_members_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
      `,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("loadMembers", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    role: row.role as ProjectRole,
    created_at: row.created_at as string,
    user: (row.user as ProjectMemberWithUser["user"]) ?? {
      id: row.user_id as string,
      username: "?",
      display_name: "?",
      avatar_url: null,
    },
  }));
}

export async function loadWorkspace(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<WorkspaceWithMeta | null> {
  const { data: workspace, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !workspace) return null;

  const [members, membersCount, entriesCount, starsCount, memberRow, starRow] =
    await Promise.all([
      loadMembers(supabase, projectId),
      supabase
        .from("project_members")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("project_entries")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("project_stars")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("project_stars")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  return {
    ...workspace,
    members_count: membersCount.count ?? 0,
    entries_count: entriesCount.count ?? 0,
    stars_count: starsCount.count ?? 0,
    viewer_role: memberRow.data?.role ?? null,
    viewer_starred: !!starRow.data,
    members,
  };
}

export async function loadEntries(
  supabase: SupabaseClient,
  projectId: string,
  opts?: { limit?: number; offset?: number },
): Promise<WorkspaceEntryWithAuthor[]> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  const { data, error } = await supabase
    .from("project_entries")
    .select(
      `
      *,
      author:profiles!project_entries_author_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
      `,
    )
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("loadEntries", error.message);
    return [];
  }

  const entries = (data ?? []) as WorkspaceEntryWithAuthor[];
  const filePaths = entries
    .filter((e) => e.file_path)
    .map((e) => e.file_path as string);

  const signedMap = new Map<string, string>();
  if (filePaths.length) {
    const CHUNK = 50;
    for (let i = 0; i < filePaths.length; i += CHUNK) {
      const slice = filePaths.slice(i, i + CHUNK);
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(slice, 3600);
      for (const row of signed ?? []) {
        if (row.path && row.signedUrl) {
          signedMap.set(row.path, row.signedUrl);
        }
      }
    }
  }

  return entries.map((e) => ({
    ...e,
    author: Array.isArray(e.author) ? e.author[0] : e.author,
    file_url: e.file_path ? (signedMap.get(e.file_path) ?? null) : null,
    link_preview: null,
  }));
}

export async function loadInvites(
  supabase: SupabaseClient,
  projectId: string,
): Promise<WorkspaceInviteWithProject[]> {
  const { data, error } = await supabase
    .from("project_invites")
    .select(
      `
      *,
      project:projects!project_invites_project_id_fkey (
        id,
        name
      )
      `,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadInvites", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    project_id: row.project_id as string,
    invited_by: row.invited_by as string,
    invitee_id: row.invitee_id as string,
    status: row.status as "pending" | "accepted" | "rejected",
    expires_at: row.expires_at as string,
    created_at: row.created_at as string,
    project: row.project as WorkspaceInviteWithProject["project"],
  }));
}

export async function loadStars(
  supabase: SupabaseClient,
  projectId: string,
): Promise<WorkspaceStarWithUser[]> {
  const { data, error } = await supabase
    .from("project_stars")
    .select(
      `
      *,
      user:profiles!project_stars_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
      `,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadStars", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    created_at: row.created_at as string,
    user: Array.isArray(row.user) ? row.user[0] : row.user,
  }));
}

export async function loadVisibleWorkspaces(
  supabase: SupabaseClient,
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<WorkspaceWithMeta[]> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      *,
      members:project_members (
        project_id,
        user_id,
        role,
        created_at
      )
      `,
    )
    .or(`user_id.eq.${userId},visibility.in.(public,unlisted)`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("loadVisibleWorkspaces", error.message);
    return [];
  }

  type ProjectRow = Omit<WorkspaceWithMeta, "members_count" | "entries_count" | "stars_count" | "viewer_role" | "viewer_starred"> & {
    members: { user_id: string; role: WorkspaceWithMeta["viewer_role"] }[];
  };
  const raw = (data ?? []) as ProjectRow[];

  return raw.map((p) => {
    const viewerRole = p.members?.find((m: { user_id: string; role: WorkspaceWithMeta["viewer_role"] }) => m.user_id === userId)?.role ?? null;
    return {
      ...p,
      members_count: p.members?.length ?? 0,
      entries_count: 0,
      stars_count: 0,
      viewer_role: viewerRole,
      viewer_starred: false,
    };
  });
}
