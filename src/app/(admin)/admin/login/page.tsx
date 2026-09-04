import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "@/features/admin/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Logo href={null} variant="mark" wordmark className="mb-8 text-ink" />
      <h1 className="font-serif text-3xl tracking-tight">Staff desk</h1>
      <p className="mt-2 text-sm text-ink/70">Sign in with the address the camp invited.</p>
      <div className="mt-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
