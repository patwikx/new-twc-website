import { auth } from "@/auth";
import { Permission, ROLE_PERMISSIONS } from "@/lib/permissions";
import { redirect } from "next/navigation";

export async function getCurrentRole() {
  const session = await auth();
  return session?.user?.role;
}

import { db } from "@/lib/db";

export async function hasPermission(permission: Permission): Promise<boolean> {
  const session = await auth();
  
  if (!session?.user?.id) return false;

  // 1. Check for legacy Enum Role (Admin gets everything? Or just mapped permissions)
  if (session.user.role === "ADMIN") return true; // Super Admin Override

  // 2. Check for Dynamic Role in DB
  // optimization: maybe cache this or include in session if frequent
  const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { 
          role: true, // Legacy Enum
          userRole: { // Dynamic Role
              select: { permissions: true } 
          } 
      }
  });

  if (!user) return false;

  // Priority to Dynamic Role
  if (user.userRole) {
      return user.userRole.permissions.includes(permission);
  }

  // Fallback to legacy Enum mapping
  const role = user.role;
  if (!role) return false;
  
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

export async function requirePermission(permission: Permission) {
  const has = await hasPermission(permission);
  if (!has) {
    redirect("/admin"); // Redirect to dashboard or specialized 403 page
  }
}
