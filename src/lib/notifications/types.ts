export type NotificationType =
  | "novo_seguidor"
  | "curtida"
  | "comentario"
  | "mensagem"
  | "mencao"
  | "aprovacao_modo_profissional"
  | "aprovacao_verificacao";

export type NotificationRow = {
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

export type NotificationActor = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type NotificationView = NotificationRow & {
  actor: NotificationActor | null;
  extra_actors: NotificationActor[];
};

export function formatNotificationCopy(
  n: NotificationView,
): { title: string; href: string } {
  const name =
    n.actor?.display_name || n.actor?.username || "Alguem";
  const count = n.actor_count;

  switch (n.type) {
    case "novo_seguidor":
      return {
        title: `${name} comecou a seguir-te`,
        href: n.actor?.username ? `/u/${n.actor.username}` : "/notificacoes",
      };
    case "curtida": {
      if (count <= 1) {
        return {
          title: `${name} gostou da tua publicacao`,
          href: n.reference_id ? `/p/${n.reference_id}` : "/notificacoes",
        };
      }
      const others = count - 1;
      const second = n.extra_actors[0];
      if (second && count === 2) {
        const n2 = second.display_name || second.username;
        return {
          title: `${name} e ${n2} gostaram da tua publicacao`,
          href: n.reference_id ? `/p/${n.reference_id}` : "/notificacoes",
        };
      }
      if (second) {
        const n2 = second.display_name || second.username;
        const more = others - 1;
        return {
          title: `${name}, ${n2} e mais ${more} gostaram da tua publicacao`,
          href: n.reference_id ? `/p/${n.reference_id}` : "/notificacoes",
        };
      }
      return {
        title: `${name} e mais ${others} gostaram da tua publicacao`,
        href: n.reference_id ? `/p/${n.reference_id}` : "/notificacoes",
      };
    }
    case "comentario":
      return {
        title: `${name} comentou a tua publicacao`,
        href: n.reference_id ? `/p/${n.reference_id}` : "/notificacoes",
      };
    case "mensagem":
      return {
        title: `${name} enviou-te uma mensagem`,
        href: n.reference_id ? `/mensagens/${n.reference_id}` : "/mensagens",
      };
    case "mencao":
      return {
        title: `${name} mencionou-te`,
        href: n.reference_id ? `/p/${n.reference_id}` : "/notificacoes",
      };
    case "aprovacao_modo_profissional":
      return {
        title: "Modo profissional aprovado",
        href: "/perfil/definicoes/profissional",
      };
    case "aprovacao_verificacao":
      return {
        title: "Selo de verificacao activo",
        href: "/perfil/definicoes/verificacao",
      };
    default:
      return { title: "Nova actividade", href: "/notificacoes" };
  }
}

export function unreadBadgeLabel(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}
