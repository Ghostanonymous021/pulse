import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Telefone ou e-mail, com a tua palavra-passe.
        </p>
      </div>
      <AuthForm mode="login" />
      <div className="mt-6 text-center">
        <Link
          href="/recuperar-senha"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Esqueceste a palavra-passe?
        </Link>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda sem conta?{" "}
        <Link href="/signup" className="font-medium text-foreground">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
