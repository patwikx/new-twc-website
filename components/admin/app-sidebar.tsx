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
  Calendar,
  CalendarDays, 
  BedDouble, 
  Users, 
  Settings,
  ShieldCheck,
  Package,
  Truck,
  ClipboardList,
  ChefHat,
  Utensils,
  Trash2,
  BarChart3,
  FileText,
  Shirt,
  ClipboardCheck,
  History,
  Bell,
  Store,
  CreditCard,
  Clock,
} from "lucide-react"

// Navigation structure organized by functional areas
const NAV_GROUPS = [
  {
    label: "Dashboard",
    items: [
      { title: "Overview", icon: LayoutDashboard, url: "/admin", permission: "analytics:view" },
    ],
  },
  {
    label: "Management",
    items: [
       {
          title: "Operations",
          icon: BedDouble,
          url: "/admin/operations",
          permission: "bookings:view",
          items: [
             { title: "Front Desk", url: "/admin/front-desk" },
             { title: "Calendar", url: "/admin/calendar" },
             { title: "Bookings", url: "/admin/bookings" },
             { title: "Guests", url: "/admin/guests" },
             { title: "Housekeeping", url: "/admin/housekeeping/linens" },
          ]
       },
       {
          title: "Point of Sale",
          icon: CreditCard,
          url: "/admin/pos",
          permission: "properties:view",
          items: [
             { title: "Terminal", url: "/admin/pos" },
             { title: "Kitchen Display", url: "/admin/pos/kitchen" },
             { title: "Outlets", url: "/admin/pos/outlets" },
             { title: "Shifts", url: "/admin/pos/shifts" },
          ]
       },
       {
          title: "Catalog",
          icon: Store,
          url: "/admin/catalog",
          permission: "properties:view",
          items: [
             { title: "Menu Items", url: "/admin/restaurant/menu" },
             { title: "Recipes", url: "/admin/restaurant/recipes" },
             { title: "Stock Items", url: "/admin/inventory/items" },
          ]
       },
       {
          title: "Inventory",
          icon: Package,
          url: "/admin/inventory",
          permission: "properties:view",
          items: [
             { title: "Purchasing", url: "/admin/inventory/purchase-orders" },
             { title: "Suppliers", url: "/admin/inventory/suppliers" },
             { title: "Stock Movement", url: "/admin/inventory/receive" },
             { title: "Requisitions", url: "/admin/inventory/requisitions" },
             { title: "Cycle Counts", url: "/admin/inventory/cycle-counts" },
             { title: "Waste Tracking", url: "/admin/inventory/waste" },
          ]
       },
       {
          title: "Insights",
          icon: BarChart3,
          url: "/admin/reports",
          permission: "analytics:view",
          items: [
             { title: "Analytics", url: "/admin/dashboard/analytics" },
             { title: "Inventory Reports", url: "/admin/reports/inventory" },
             { title: "Sales Reports", url: "/admin/reports/restaurant" },
          ]
       },
       {
          title: "Administration",
          icon: Settings,
          url: "/admin/settings",
          permission: "settings:view",
          items: [
             { title: "Properties", url: "/admin/properties" },
             { title: "Users & Roles", url: "/admin/users" },
             { title: "General Settings", url: "/admin/settings" },
          ]
       }
    ]
  }
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
  // Filter navigation groups based on permissions
  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => 
      !item.permission || permissions.includes(item.permission)
    ),
  })).filter(group => group.items.length > 0);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <PropertySwitcher properties={properties} currentScope={currentScope} isAdmin={isAdmin} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={filteredGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
