"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { emailSchema, validate } from "@/lib/validations";
import { z } from "zod";
import { safeNext } from "@/lib/utils/safe-redirect";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") });

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(
    params.get("error") === "link" ? "That link is invalid or has expired. Please try again." : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = validate(schema, { email: fd.get("email"), password: fd.get("password") });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setFormError(null);
    setLoading(true);
    const { error } = await getSupabaseBrowser().auth.signInWithPassword(v.data);
    setLoading(false);
    if (error) {
      setFormError(
        /confirm/i.test(error.message)
          ? "Please confirm your email first — check your inbox for the link."
          : /invalid/i.test(error.message)
            ? "Incorrect email or password."
            : error.message
      );
      return;
    }
    qc.clear(); // never show a previous user's cached data
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your StudyFlow workspace"
      footer={
        <>
          New to StudyFlow?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormError message={formError} />
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-[13px] text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
