import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { getAccessibleProperties } from "@/lib/data-access";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/admin/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator";
import { DynamicBreadcrumbs } from "@/components/admin/breadcrumbs";
import { NotificationDropdown } from "@/components/admin/notifications/notification-dropdown";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
      redirect("/"); 
  }

  // Get role for checking permissions
  const role = session?.user?.role;
  const permissions = role ? ROLE_PERMISSIONS[role] : [];

  // Scoping Data
  const accessibleProperties = await getAccessibleProperties();
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || (role === "ADMIN" ? "ALL" : accessibleProperties[0]?.id || "");
  const isAdmin = role === "ADMIN";

  const user = {
      name: session.user.name || "User",
      email: session.user.email || "",
      avatar: session.user.image || "",
  };

  return (
    <SidebarProvider>
      <AppSidebar 
        user={user} 
        properties={accessibleProperties} 
        permissions={permissions}
        currentScope={currentScope}
        isAdmin={isAdmin} 
      />
      <SidebarInset className="bg-black">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-white/5 bg-black px-4">
          <div className="flex items-center gap-2 flex-1">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <DynamicBreadcrumbs />
          </div>
          <div className="flex items-center gap-2">
            <NotificationDropdown userId={session.user.id!} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 bg-black text-white min-h-screen">
          <div className="p-4">
             {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
