import { PulseWordmark } from "@/components/brand/pulse-wordmark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-12">
      <PulseWordmark className="mb-8 h-6 w-auto text-foreground" />
      {children}
    </div>
  );
}
