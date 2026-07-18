import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function requireProfile(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: NonNullable<
    Awaited<
      ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>
    >["data"]["user"]
  >;
  profile: Profile;
}> {
  const { supabase, user } = await requireUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  return { supabase, user, profile: profile as Profile };
}
