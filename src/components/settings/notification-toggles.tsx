"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AtSign,
  Heart,
  MessageCircle,
  MessageSquare,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { SettingsGroup } from "@/components/settings/settings-group";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSwitch } from "@/components/settings/settings-switch";
import type { NotificationPrefs } from "@/lib/settings/prefs";
import { createClient } from "@/lib/supabase/client";

type Key = keyof Omit<NotificationPrefs, "user_id">;

const ITEMS: { key: Key; label: string; icon: LucideIcon }[] = [
  { key: "new_followers", label: "Novos seguidores", icon: UserPlus },
  { key: "likes", label: "Curtidas", icon: Heart },
  { key: "comments", label: "Comentarios", icon: MessageCircle },
  { key: "messages", label: "Mensagens", icon: MessageSquare },
  { key: "mentions", label: "Mencoes", icon: AtSign },
];

export function NotificationToggles({
  initial,
  title,
}: {
  initial: NotificationPrefs;
  /** When set, wraps rows in a titled SettingsGroup (main page). */
  title?: string;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [pendingKey, setPendingKey] = useState<Key | null>(null);
  const [, startTransition] = useTransition();

  function setKey(key: Key, next: boolean) {
    const prev = prefs;
    const nextPrefs = { ...prefs, [key]: next };
    setPrefs(nextPrefs);
    setPendingKey(key);
    startTransition(async () => {
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
        router.refresh();
      } catch {
        setPrefs(prev);
      } finally {
        setPendingKey(null);
      }
    });
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
