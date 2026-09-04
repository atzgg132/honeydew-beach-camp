import { Logo } from "@/components/brand/Logo";
import { AcceptForm } from "@/features/admin/auth/AcceptForm";

export default async function AdminAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Logo href={null} variant="mark" wordmark className="mb-8 text-ink" />
      <h1 className="font-serif text-3xl tracking-tight">Set your password</h1>
      <p className="mt-2 text-sm text-ink/70">This invitation can be used once.</p>
      <div className="mt-8">
        <AcceptForm token={token} />
      </div>
    </main>
  );
}
