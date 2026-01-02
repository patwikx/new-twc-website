"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ShieldCheck, Info, Loader2 } from "lucide-react";
import { createRole, updateRole } from "@/actions/admin/roles";
import { ROLE_PERMISSIONS, Permission } from "@/lib/permissions";

// Group permissions for better UI
const PERMISSION_GROUPS = [
    {
        label: "Properties & Rooms",
        permissions: [
            "properties:view", "properties:create", "properties:edit", "properties:delete",
            "rooms:view", "rooms:create", "rooms:edit", "rooms:delete",
        ]
    },
    {
        label: "Bookings & Payments",
        permissions: [
            "bookings:view", "bookings:create", "bookings:edit", "bookings:cancel",
            "payments:view", "payments:refund",
        ]
    },
    {
        label: "Users & Membership",
        permissions: [
            "users:view", "users:edit", "users:delete",
            "membership:view", "membership:manage",
        ]
    },
    {
        label: "Content & Marketing",
        permissions: [
            "content:view", "content:create", "content:edit", "content:delete",
            "marketing:view", "coupons:create", "coupons:edit", "coupons:delete",
            "newsletter:view", "newsletter:export",
        ]
    },
    {
        label: "System & Analytics",
        permissions: [
            "reviews:view", "reviews:moderate",
            "analytics:view",
            "settings:view", "settings:manage",
        ]
    }
];

interface RoleFormProps {
    role?: {
        id: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        permissions: string[];
    } | null;
    isEditMode?: boolean;
}

export function RoleForm({ role, isEditMode = false }: RoleFormProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role?.permissions || []);

    const togglePermission = (perm: string) => {
        setSelectedPermissions(prev => 
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    const toggleGroup = (perms: string[]) => {
        const allSelected = perms.every(p => selectedPermissions.includes(p));
        if (allSelected) {
            // Deselect all
            setSelectedPermissions(prev => prev.filter(p => !perms.includes(p)));
        } else {
            // Select all
            setSelectedPermissions(prev => [...new Set([...prev, ...perms])]);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        selectedPermissions.forEach(p => formData.append("permissions", p));

        startTransition(async () => {
            if (isEditMode && role?.id) {
                const result = await updateRole(role.id, formData);
                if (result.error) toast.error(result.error);
                else {
                    toast.success("Role updated successfully");
                    router.push("/admin/roles");
                }
            } else {
                const result = await createRole(formData);
                if (result.error) toast.error(result.error);
                else {
                    toast.success("Role created successfully");
                    router.push("/admin/roles");
                }
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
             {/* Main Column */}
             <div className="lg:col-span-8 space-y-6">
                
                {/* Basic Info */}
                <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <ShieldCheck className="h-4 w-4 text-purple-400" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Role Details</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm"
                                onClick={() => router.back()}
                                className="text-neutral-400 hover:text-white hover:bg-white/5 h-8 px-3 text-xs"
                                disabled={isPending}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                size="sm"
                                disabled={isPending}
                                className="bg-white text-black hover:bg-neutral-200 h-8 px-4 text-xs font-semibold"
                            >
                                {isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                                {isEditMode ? "Save Changes" : "Create Role"}
                            </Button>
                        </div>
                    </div>
                    <Separator className="bg-white/10" />

                    <div className="grid gap-4">
                        <div className="space-y-2">
                             <Label className="text-neutral-400">Role Name <span className="text-red-500">*</span></Label>
                             <Input 
                                name="name" 
                                required 
                                defaultValue={role?.name || ""}
                                disabled={isPending || role?.isSystem}
                                placeholder="e.g. Booking Manager"
                                className="bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-purple-500/50"
                             />
                             {role?.isSystem && <p className="text-[10px] text-amber-500">System role names cannot be changed.</p>}
                        </div>

                        <div className="space-y-2">
                             <Label className="text-neutral-400">Description</Label>
                             <Textarea 
                                name="description" 
                                defaultValue={role?.description || ""}
                                disabled={isPending}
                                placeholder="Brief description of responsibilities..."
                                className="bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-purple-500/50 min-h-[80px]"
                             />
                        </div>
                    </div>
                </div>

                {/* Permissions Grid */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 text-white">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider">Permissions</h3>
                    </div>
                    <Separator className="bg-white/10" />

                    <div className="grid gap-6">
                        {PERMISSION_GROUPS.map((group, idx) => (
                            <div key={idx} className="space-y-3 rounded-lg border border-white/5 bg-white/5 p-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-white">{group.label}</h4>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleGroup(group.permissions)}
                                        className="h-6 text-[10px] text-neutral-400 hover:text-white"
                                    >
                                        Toggle All
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {group.permissions.map(perm => {
                                        const isChecked = selectedPermissions.includes(perm);
                                        return (
                                            <div 
                                                key={perm}
                                                onClick={() => !isPending && togglePermission(perm)}
                                                className={`
                                                cursor-pointer select-none flex items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors border
                                                    ${isChecked 
                                                        ? "bg-purple-500/10 border-purple-500/30 text-purple-100" 
                                                        : "bg-transparent border-transparent hover:bg-white/5 text-neutral-400 hover:text-neutral-300"}
                                                `}
                                            >
                                                <span className="text-xs font-medium">{perm}</span>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <Switch 
                                                        checked={isChecked} 
                                                        onCheckedChange={() => togglePermission(perm)}
                                                        className="data-[state=checked]:bg-purple-500 scale-75"
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

             </div>

             {/* Sidebar Info */}
             <div className="lg:col-span-4 space-y-6">
                 <div className="flex items-center gap-2 text-white mb-4 mt-10">
                    <Info className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Security Note</h3>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                    <h4 className="text-amber-400 font-medium text-sm mb-2">Power User Warning</h4>
                     <p className="text-xs text-neutral-400 leading-relaxed">
                        Granting <strong>settings:manage</strong> or <strong>users:delete</strong> permissions allows this role to potentially modify system critical configurations or remove other administrators.
                    </p>
                    <div className="mt-3 text-xs text-amber-500 font-medium bg-amber-500/10 p-2 rounded">
                        Be careful when assigning these to non-admin staff.
                    </div>
                </div>

                 <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                    <h4 className="text-purple-400 font-medium text-sm mb-2">Role Inheritance</h4>
                     <p className="text-xs text-neutral-400 leading-relaxed">
                        Permissions are additive. Users belonging to multiple groups or with additional direct permissions will inherit the union of all granted rights.
                    </p>
                </div>
             </div>
        </form>
    );
}
