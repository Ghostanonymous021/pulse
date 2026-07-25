import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = {
  title: "Nova senha",
};

export default function NovaSenhaPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Define a nova senha da tua conta.
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
