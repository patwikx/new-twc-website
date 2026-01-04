"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { type LucideIcon, ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavSubItem {
  title: string
  url: string
}

interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  items?: NavSubItem[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

function NavCollapsibleItem({ item, isActive }: { item: NavItem; isActive: (url: string) => boolean }) {
  const isGroupActive = useCallback(() => {
    if (item.items && item.items.length > 0) {
      return item.items.some(sub => isActive(sub.url));
    }
    return isActive(item.url);
  }, [item, isActive]);

  const [open, setOpen] = useState(false);

  // Set initial open state after mount to avoid hydration mismatch
  useEffect(() => {
    setOpen(isGroupActive());
  }, [isGroupActive]);

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} className="h-8">
            {item.icon && <item.icon className="h-4 w-4" />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-3 border-l border-white/10 px-2 py-0.5">
            {item.items?.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton 
                  asChild 
                  isActive={isActive(subItem.url)}
                  className="h-7 text-xs"
                >
                  <Link href={subItem.url}>
                    <span>{subItem.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavMain({
  groups,
}: {
  groups: NavGroup[]
}) {
  const pathname = usePathname();

  const isActive = useCallback((url: string) => {
    return pathname === url || pathname.startsWith(url + "/");
  }, [pathname]);

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label} className="py-1 px-2">
          <SidebarGroupLabel className="h-6 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {group.label}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {group.items.map((item) => (
              item.items && item.items.length > 0 ? (
                <NavCollapsibleItem 
                  key={item.title} 
                  item={item} 
                  isActive={isActive} 
                />
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title} 
                    isActive={isActive(item.url)}
                    className="h-8"
                  >
                    <Link href={item.url}>
                      {item.icon && <item.icon className="h-4 w-4" />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
