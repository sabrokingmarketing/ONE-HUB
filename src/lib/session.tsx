import { createContext, useContext } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Permission } from "../../convex/lib/permissionMatrix";

export type Me = NonNullable<FunctionReturnType<typeof api.users.me>>;

export const SessionContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error("useMe must be used inside an authenticated route");
  return me;
}

export function useCan() {
  const me = useMe();
  return (...anyOf: Permission[]) => anyOf.some((p) => me.permissions.includes(p));
}
