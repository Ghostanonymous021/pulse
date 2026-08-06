import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Criar conta",
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="text-sm text-muted-foreground">
          Nome, username e telefone. O resto do perfil fica para depois, sem pressa.
        </p>
      </div>
      <AuthForm mode="signup" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ja tens conta?{" "}
        <Link href="/login" className="font-medium text-foreground">
          Entrar
        </Link>
      </p>
    </>
  );
}
