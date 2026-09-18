"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type WorkspaceAccess = {
  allowedModuleSlugs: string[];
  permissionKeys: string[];
};

const WorkspaceAccessContext =
  createContext<WorkspaceAccess | null>(null);

export function WorkspaceAccessProvider({
  allowedModuleSlugs,
  permissionKeys,
  children,
}: WorkspaceAccess & {
  children: ReactNode;
}) {
  return (
    <WorkspaceAccessContext.Provider
      value={{ allowedModuleSlugs, permissionKeys }}
    >
      {children}
    </WorkspaceAccessContext.Provider>
  );
}

/**
 * A missing provider is intentionally treated as no access. This prevents a
 * client render from ever widening navigation visibility.
 */
export function useWorkspaceAccess(): WorkspaceAccess {
  return (
    useContext(WorkspaceAccessContext) ?? {
      allowedModuleSlugs: [],
      permissionKeys: [],
    }
  );
}
