import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { errorCode, errorMessage } from "./utils";

/** Mutation with loading state + toast on success / friendly error toast on failure. */
export function useAction<M extends FunctionReference<"mutation">>(ref: M, opts: { success?: string } = {}) {
  const mutate = useMutation(ref);
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (args: FunctionArgs<M>): Promise<FunctionReturnType<M> | undefined> => {
      setPending(true);
      try {
        const r = await mutate(args);
        if (opts.success) toast.success(opts.success);
        return r;
      } catch (e) {
        const code = errorCode(e);
        toast.error(code === "CONFLICT" ? "Someone else just changed this" : "Couldn't complete that", { description: errorMessage(e) });
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [mutate, opts.success],
  );
  return [run, pending] as const;
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export async function uploadFile(uploadUrl: string, file: File): Promise<string> {
  const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!res.ok) throw new Error("Upload failed");
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}
