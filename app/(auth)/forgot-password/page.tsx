"use client";
import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { emailSchema, validate } from "@/lib/validations";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validate(z.object({ email: emailSchema }), { email: new FormData(e.currentTarget).get("email") });
    if (!v.ok) return setFieldError(v.errors.email);
    setFieldError(undefined);
    setError(null);
    setLoading(true);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(v.data.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setSent(true); // same message whether or not the account exists
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : "We'll email you a secure reset link"}
      footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to log in</Link>}
    >
      {sent ? (
        <p className="text-center text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way. The link expires after a short time.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Email" htmlFor="email" error={fieldError}>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!fieldError} />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
