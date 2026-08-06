"use client";

import { useState } from "react";

import { SettingsSwitch } from "@/components/settings/settings-switch";
import { createClient } from "@/lib/supabase/client";

export function PrivacySwitch({ initialPrivate }: { initialPrivate: boolean }) {
  const [on, setOn] = useState(initialPrivate);
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    const prev = on;
    setOn(next);
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("no session");

      const { error } = await supabase
        .from("profiles")
        .update({ is_private: next })
        .eq("id", user.id);
      if (error) throw error;

      if (!next) {
        await supabase
          .from("follows")
          .update({ status: "accepted" })
          .eq("following_id", user.id)
          .eq("status", "pending");
      }
    } catch {
      setOn(prev);
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsSwitch
      checked={on}
      onCheckedChange={toggle}
      disabled={pending}
      aria-label="Conta privada"
    />
  );
}
