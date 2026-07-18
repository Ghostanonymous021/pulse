"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SettingsSwitch } from "@/components/settings/settings-switch";
import { createClient } from "@/lib/supabase/client";

/**
 * Conta privada — writes profiles.is_private.
 * Public transition accepts pending follow requests (Instagram pattern).
 */
export function PrivacySwitch({ initialPrivate }: { initialPrivate: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initialPrivate);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    const prev = on;
    setOn(next);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
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

        router.refresh();
      } catch {
        setOn(prev);
      }
    });
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
