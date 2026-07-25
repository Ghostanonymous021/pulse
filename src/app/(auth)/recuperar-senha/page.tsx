import Link from "next/link";

import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata = {
  title: "Recuperar palavra-passe",
};

export default function PasswordResetPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recuperar palavra-passe
        </h1>
        <p className="text-sm text-muted-foreground">
          Enviaremos um link seguro para o teu telefone ou e-mail.
        </p>
      </div>

      <PasswordResetForm />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Lembraste da palavra-passe?{" "}
        <Link href="/login" className="font-medium text-foreground">
          Entrar
        </Link>
      </p>
    </div>
  );
}
