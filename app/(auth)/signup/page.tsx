"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { emailSchema, passwordSchema, validate } from "@/lib/validations";

const schema = z
  .object({
    display_name: z.string().trim().min(1, "Enter your name").max(60),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export default function SignupPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = validate(schema, Object.fromEntries(fd));
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setFormError(null);
    setLoading(true);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { data, error } = await getSupabaseBrowser().auth.signUp({
      email: v.data.email,
      password: v.data.password,
      options: { data: { display_name: v.data.display_name }, emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
    });
    setLoading(false);
    if (error) return setFormError(error.message);
    if (data.session) {
      // Email confirmation disabled in Supabase — go straight to onboarding.
      router.replace("/onboarding");
      router.refresh();
    } else {
      setSentTo(v.data.email);
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email" footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to log in</Link>}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
            <MailCheck className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>. Open it to finish setting up your account.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Free, private, and built for students"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormError message={formError} />
        <Field label="Your name" htmlFor="display_name" error={errors.display_name}>
          <Input id="display_name" name="display_name" autoComplete="given-name" aria-invalid={!!errors.display_name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters, with a letter and a number">
          <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
