"use client";

import { useTransition } from "react";
import { setAdminPropertyScope } from "@/actions/admin/app-state";
import { Building2, Layers, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface PropertySwitcherProps {
    properties: { id: string, name: string }[];
    currentScope: string;
    isAdmin: boolean;
}

export function PropertySwitcher({ properties, currentScope, isAdmin }: PropertySwitcherProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { isMobile } = useSidebar();

    const activeProperty = currentScope === "ALL" 
        ? { name: "All Properties", logo: Layers, id: "ALL" }
        : { 
            name: properties.find(p => p.id === currentScope)?.name || "Select Property", 
            logo: Building2, 
            id: currentScope 
          };

    const handleSwitch = (value: string) => {
        startTransition(async () => {
             await setAdminPropertyScope(value);
             toast.success(value === "ALL" ? "Viewing All Properties" : "Switched Property View");
             router.refresh();
        });
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <activeProperty.logo className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{activeProperty.name}</span>
                                <span className="truncate text-xs">Business Unit</span>
                            </div>
                            <ChevronsUpDown className="ml-auto" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                        align="start"
                        side={isMobile ? "bottom" : "right"}
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Properties
                        </DropdownMenuLabel>
                        {isAdmin && (
                            <DropdownMenuItem onClick={() => handleSwitch("ALL")} className="gap-2 p-2 cursor-pointer">
                                <div className="flex size-6 items-center justify-center rounded-sm border">
                                    <Layers className="size-4 shrink-0" />
                                </div>
                                All Properties
                                <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        )}
                        {properties.map((property) => (
                            <DropdownMenuItem key={property.id} onClick={() => handleSwitch(property.id)} className="gap-2 p-2 cursor-pointer">
                                <div className="flex size-6 items-center justify-center rounded-sm border">
                                    <Building2 className="size-4 shrink-0" />
                                </div>
                                {property.name}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 p-2" disabled>
                            <div className="flex size-6 items-center justify-center rounded-sm border">
                                <Plus className="size-4 shrink-0" />
                            </div>
                            <div className="font-medium text-muted-foreground">Add Property</div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
