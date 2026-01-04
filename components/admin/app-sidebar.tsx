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
      { 
        title: "Analytics", 
        icon: BarChart3, 
        url: "/admin/dashboard/analytics",
        permission: "analytics:view",
        items: [
          { title: "Overview", url: "/admin/dashboard/analytics" },
          { title: "Inventory", url: "/admin/dashboard/inventory" },
          { title: "Sales", url: "/admin/dashboard/sales" },
        ],
      },
    ],
  },
  {
    label: "Reservations",
    items: [
      { title: "Bookings", icon: CalendarDays, url: "/admin/bookings", permission: "bookings:view" },
      { title: "Front Desk", icon: BedDouble, url: "/admin/front-desk", permission: "bookings:edit" },
    ],
  },
  {
    label: "Point of Sale",
    items: [
      { 
        title: "POS Terminal", 
        icon: CreditCard, 
        url: "/admin/pos",
        permission: "properties:view",
      },
      { 
        title: "Kitchen Display", 
        icon: ChefHat, 
        url: "/admin/pos/kitchen",
        permission: "properties:view",
      },
      { 
        title: "Outlets", 
        icon: Store, 
        url: "/admin/pos/outlets",
        permission: "properties:view",
      },
      { 
        title: "Shifts", 
        icon: Clock, 
        url: "/admin/pos/shifts",
        permission: "properties:view",
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      { 
        title: "Stock Management", 
        icon: Package, 
        url: "/admin/inventory/items",
        permission: "properties:view",
        items: [
          { title: "Stock Items", url: "/admin/inventory/items" },
          { title: "Categories", url: "/admin/inventory/categories" },
          { title: "Warehouses", url: "/admin/inventory/warehouses" },
          { title: "Receive Stock", url: "/admin/inventory/receive" },
          { title: "Transfer Stock", url: "/admin/inventory/transfer" },
          { title: "Stock Adjustment", url: "/admin/inventory/adjust" },
          { title: "Bulk Import", url: "/admin/inventory/bulk/import" },
        ],
      },
      { 
        title: "Purchase Orders", 
        icon: FileText, 
        url: "/admin/inventory/purchase-orders",
        permission: "properties:view",
      },
      { 
        title: "Suppliers", 
        icon: Truck, 
        url: "/admin/inventory/suppliers",
        permission: "properties:view",
        items: [
          { title: "Supplier List", url: "/admin/inventory/suppliers" },
          { title: "Receive Consignment", url: "/admin/inventory/consignment/receive" },
          { title: "Settlements", url: "/admin/inventory/consignment/settlements" },
        ],
      },
      { 
        title: "Requisitions", 
        icon: ClipboardList, 
        url: "/admin/inventory/requisitions",
        permission: "properties:view",
      },
      { 
        title: "Cycle Counts", 
        icon: ClipboardCheck, 
        url: "/admin/inventory/cycle-counts",
        permission: "cycle-count:view",
      },
    ],
  },
  {
    label: "Food & Beverage",
    items: [
      { 
        title: "Recipes", 
        icon: ChefHat, 
        url: "/admin/restaurant/recipes",
        permission: "properties:view",
      },
      { 
        title: "Menu Items", 
        icon: Utensils, 
        url: "/admin/restaurant/menu",
        permission: "properties:view",
      },
      { 
        title: "Waste Tracking", 
        icon: Trash2, 
        url: "/admin/inventory/waste",
        permission: "properties:view",
      },
    ],
  },
  {
    label: "Housekeeping",
    items: [
      { 
        title: "Linens", 
        icon: Shirt, 
        url: "/admin/housekeeping/linens",
        permission: "properties:view",
      },
    ],
  },
  {
    label: "Reports",
    items: [
      { 
        title: "Inventory Reports", 
        icon: BarChart3, 
        url: "/admin/reports/inventory",
        permission: "analytics:view",
      },
      { 
        title: "Restaurant Reports", 
        icon: ChefHat, 
        url: "/admin/reports/restaurant",
        permission: "analytics:view",
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      { title: "Properties", icon: Building2, url: "/admin/properties", permission: "properties:view" },
      { 
        title: "Master Data", 
        icon: FileText, 
        url: "/admin/settings/master-data",
        permission: "settings:view",
        items: [
          { title: "Units of Measure", url: "/admin/settings/units" },
        ],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users", icon: Users, url: "/admin/users", permission: "users:view" },
      { title: "Roles & Permissions", icon: ShieldCheck, url: "/admin/roles", permission: "settings:manage" },
      { title: "Notifications", icon: Bell, url: "/admin/notifications", permission: "settings:view" },
      { title: "Audit Log", icon: History, url: "/admin/audit", permission: "settings:view" },
      { title: "Settings", icon: Settings, url: "/admin/settings", permission: "settings:view" },
    ],
  },
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
