"use client";

import { useState } from "react";

import { SettingsGroup } from "@/components/settings/settings-group";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSwitch } from "@/components/settings/settings-switch";
import type { NotificationPrefs } from "@/lib/settings/prefs";
import { createClient } from "@/lib/supabase/client";

type Key = keyof Omit<NotificationPrefs, "user_id">;

const ITEMS: { key: Key; label: string; icon: LucideIcon }[] = [
  { key: "new_followers", label: "Novos seguidores", icon: UserPlus },
  { key: "likes", label: "Curtidas", icon: Heart },
  { key: "comments", label: "Comentários", icon: MessageCircle },
  { key: "mentions", label: "Menções", icon: AtSign },
];

export function NotificationToggles({
  initial,
  title,
}: {
  initial: NotificationPrefs;
  title?: string;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pendingKey, setPendingKey] = useState<Key | null>(null);

  async function setKey(key: Key, next: boolean) {
    const prev = prefs;
    const nextPrefs = { ...prefs, [key]: next };
    setPrefs(nextPrefs);
    setPendingKey(key);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");

      const payload = {
        user_id: user.id,
        new_followers: nextPrefs.new_followers,
        likes: nextPrefs.likes,
        comments: nextPrefs.comments,
        messages: nextPrefs.messages,
        mentions: nextPrefs.mentions,
      };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload);
      if (error) throw error;
    } catch {
      setPrefs(prev);
    } finally {
      setPendingKey(null);
    }
  }

  const rows = ITEMS.map(({ key, label, icon }) => (
    <SettingsRow
      key={key}
      icon={icon}
      label={label}
      control={
        <SettingsSwitch
          checked={prefs[key]}
          onCheckedChange={(v) => setKey(key, v)}
          disabled={pendingKey === key}
          aria-label={label}
        />
      }
    />
  ));

  return <SettingsGroup title={title}>{rows}</SettingsGroup>;
}
