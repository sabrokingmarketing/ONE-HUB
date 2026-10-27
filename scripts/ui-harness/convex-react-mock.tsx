/**
 * DEV-ONLY visual QA harness. Replaces `convex/react` with static sample
 * fixtures so the UI can be screenshotted without a backend. Never bundled
 * into the real app (see scripts/ui-harness/vite.config.ts).
 */
import { getFunctionName } from "convex/server";
import { fixtures } from "./fixtures";

type Ref = Parameters<typeof getFunctionName>[0];
const name = (ref: Ref) => getFunctionName(ref).replace(":", ".");

export function useQuery(ref: Ref, args?: unknown) {
  if (args === "skip") return undefined;
  const f = fixtures[name(ref)];
  return typeof f === "function" ? (f as (a: unknown) => unknown)(args) : f;
}
export function usePaginatedQuery(ref: Ref, args: unknown) {
  const r = useQuery(ref, args) as { page: unknown[] } | undefined;
  return { results: r?.page ?? [], status: r ? "Exhausted" : "LoadingFirstPage", loadMore: () => {}, isLoading: !r };
}
export const useMutation = () => Object.assign(async () => undefined, { withOptimisticUpdate: () => async () => undefined });
export const useAction = useMutation;
export const useConvex = () => ({ query: async () => [] });
export const useConvexAuth = () => ({ isLoading: false, isAuthenticated: true });
export class ConvexReactClient { constructor(_: string) {} }
export const ConvexProvider = ({ children }: { children: React.ReactNode }) => children;
