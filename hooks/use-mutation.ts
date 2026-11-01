"use client";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils/format";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mutation that calls a data function, toasts on success/failure and
 * invalidates the given query keys so every list shows saved records.
 */
export function useDbMutation<TVars, TResult = unknown>(
  fn: (sb: SupabaseClient, vars: TVars) => Promise<TResult>,
  opts: { invalidate: QueryKey[]; success?: string | ((r: TResult, v: TVars) => string | null); onSuccess?: (r: TResult, v: TVars) => void } = {
    invalidate: [],
  }
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => fn(getSupabaseBrowser(), vars),
    onSuccess: (r, v) => {
      opts.invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      const msg = typeof opts.success === "function" ? opts.success(r, v) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
