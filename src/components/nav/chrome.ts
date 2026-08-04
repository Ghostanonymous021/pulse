/**
 * Where global header/footer appear.
 * See docs/UX_NAVIGATION.md — main vs sub vs onboarding.
 */

export type ChromeMode = "full" | "bare" | "none";

/** Exact paths that get the full shell (header + tab bar). */
const PRIMARY_EXACT = new Set([
  "/home",
  "/pessoas",
  "/explorar",
  "/mensagens",
  "/perfil",
  "/notificacoes",
]);

// Sub-routes under /perfil/* stay bare (editar, definicoes, seguidores…)

/**
 * Returns chrome mode for a pathname (no trailing slash).
 */
export function getChromeMode(pathname: string): ChromeMode {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  // Immersive onboarding — no app chrome at all
  if (path === "/onboarding" || path.startsWith("/onboarding/")) {
    return "none";
  }

  // Primary destinations only
  if (PRIMARY_EXACT.has(path)) {
    return "full";
  }

  // Everything else under (app): focused subpages
  // /p/*, /mensagens/*, /perfil/editar, /perfil/definicoes, /u/*
  return "bare";
}
