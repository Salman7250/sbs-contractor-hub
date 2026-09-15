"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Permission = {
  module: string;
  action: string;
};

export function usePermissions() {
  const supabase = useMemo(() => createClient(), []);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPermissions([]);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError || !membership?.company_id) {
        setPermissions([]);
        return;
      }

      const { data, error } = await supabase.rpc(
        "employee_get_my_permissions",
        {
          p_company_id: membership.company_id,
        }
      );

      if (error) {
        console.error("Failed to load permissions:", error);
        setPermissions([]);
        return;
      }

      const normalized: Permission[] = (data ?? [])
        .map((item: any) => ({
          module:
            item.module ??
            item.permission_module ??
            item.module_name ??
            "",
          action:
            item.action ??
            item.permission_action ??
            item.action_name ??
            "",
        }))
        .filter(
          (permission: Permission) =>
            permission.module && permission.action
        );

      setPermissions(normalized);
    } catch (error) {
      console.error("Permission loading error:", error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback(
    (module: string, action: string) => {
      return permissions.some(
        (permission) =>
          permission.module === module &&
          permission.action === action
      );
    },
    [permissions]
  );

  const can = hasPermission;

  return {
    permissions,
    loading,
    hasPermission,
    can,
    reload: loadPermissions,
  };
}