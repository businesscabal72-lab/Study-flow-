"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { passwordSchema, validate } from "@/lib/validations";

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

// Reached via /auth/callback after the user clicks the email link (session is set by then).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validate(schema, Object.fromEntries(new FormData(e.currentTarget)));
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setLoading(true);
    const { error } = await getSupabaseBrowser().auth.updateUser({ password: v.data.password });
    setLoading(false);
    if (error) {
      return setFormError(
        /session/i.test(error.message) ? "Your reset link has expired. Request a new one from the login page." : error.message
      );
    }
    toast.success("Password updated");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormError message={formError} />
        <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters, with a letter and a number">
          <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
