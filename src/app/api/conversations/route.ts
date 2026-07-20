import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { listConversations } from "@/lib/social/messages";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const conversations = await listConversations(supabase, user.id);
  return NextResponse.json({ conversations });
}
