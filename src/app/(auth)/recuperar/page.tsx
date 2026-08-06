import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = {
  title: "Recuperar senha",
};

export default function RecuperarPage() {
  return (
    <>
      <div className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recuperar senha
        </h1>
        <p className="text-sm text-muted-foreground">
          Enviamos um link para repor a senha para o teu e-mail de
          recuperacao.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground">
          Voltar a entrar
        </Link>
      </p>
    </>
  );
}
