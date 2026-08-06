import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Telefone ou e-mail, com a tua palavra-passe.
        </p>
      </div>
      <AuthForm mode="login" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda sem conta?{" "}
        <Link href="/signup" className="font-medium text-foreground">
          Criar conta
        </Link>
      </p>
    </>
  );
}
