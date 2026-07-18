import { redirect } from "next/navigation";

/** Preferencias vivem no hub de Definicoes (toggles por tipo). */
export default function NotificacoesPrefsRedirect() {
  redirect("/perfil/definicoes");
}
