"use client";

import { createContext, useContext } from "react";
import { ALL_MODULES, type ModuleKey } from "@/lib/client-modules";

const ClientModulesContext = createContext<ModuleKey[] | null>(null);

/** Makes the current account's enabled modules available to client components without prop drilling. */
export function ClientModulesProvider({
  modules,
  children,
}: {
  modules: ModuleKey[];
  children: React.ReactNode;
}) {
  return (
    <ClientModulesContext.Provider value={modules}>
      {children}
    </ClientModulesContext.Provider>
  );
}

/** Falls back to every module enabled if read outside a provider — matches the no-ClientProfile-row default. */
export function useEnabledModules(): ModuleKey[] {
  const ctx = useContext(ClientModulesContext);
  return ctx ?? [...ALL_MODULES];
}
