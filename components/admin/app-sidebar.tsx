"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { PropertySwitcher } from "@/components/admin/PropertySwitcher"
import { NavMain } from "@/components/admin/nav-main"
import { NavUser } from "@/components/admin/nav-user"
import { 
  Building2, 
  LayoutDashboard, 
  CalendarDays, 
  BedDouble, 
  Users, 
  Settings,
  ShieldCheck
} from "lucide-react"

// Define navigation items here to avoid serialization issues
const NAV_ITEMS = [
    { title: "Overview", icon: LayoutDashboard, url: "/admin", permission: "analytics:view" },
    { title: "Bookings", icon: CalendarDays, url: "/admin/bookings", permission: "bookings:view" },
    { title: "Properties", icon: Building2, url: "/admin/properties", permission: "properties:view" },
    { title: "Rooms", icon: BedDouble, url: "/admin/rooms", permission: "rooms:view" },
    { title: "Users", icon: Users, url: "/admin/users", permission: "users:view" },
    { title: "Roles & Permissions", icon: ShieldCheck, url: "/admin/roles", permission: "settings:manage" },
    { title: "Settings", icon: Settings, url: "/admin/settings", permission: "settings:view" },
];

export function AppSidebar({ 
    user, 
    properties, 
    permissions, 
    currentScope,
    isAdmin,
    ...props 
}: React.ComponentProps<typeof Sidebar> & {
    user: { name: string, email: string, avatar: string },
    properties: { id: string, name: string }[],
    permissions: string[],
    currentScope: string,
    isAdmin: boolean
}) {
  const filteredNavItems = NAV_ITEMS.filter(item => 
    !item.permission || permissions.includes(item.permission)
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <PropertySwitcher properties={properties} currentScope={currentScope} isAdmin={isAdmin} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
