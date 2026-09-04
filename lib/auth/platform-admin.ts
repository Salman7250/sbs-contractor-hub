import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requirePlatformAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    adminError ||
    !admin ||
    !["super_admin", "support"].includes(admin.role)
  ) {
    redirect("/");
  }

  return {
    user,
    admin,
  };
}

export async function isPlatformAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(
    admin &&
      ["super_admin", "support"].includes(admin.role)
  );
}