"use client";

import { useState, useTransition } from "react";
// import { UserRole } from "@prisma/client"; // Use dynamic Role relations
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createUser, updateUserDetails } from "@/actions/admin/users";
import { useRouter } from "next/navigation";
import { Loader2, User, Building2, ShieldCheck, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Role {
    id: string;
    name: string;
    description?: string | null;
}

interface Department {
    id: string;
    name: string;
}

interface UserFormProps {
    user?: {
        id: string;
        name: string | null;
        email: string | null;
        // role: UserRole; // Legacy
        roleId: string | null;
        userRole: Role | null;
        departmentId: string | null;
        status: string; // "ACTIVE" | "INACTIVE"
        
        phone: string | null;
        address: string | null;
        nationality: string | null;
        managedProperties: { id: string }[];
        defaultPropertyId: string | null;
    } | null;
    isEditMode?: boolean;
    allProperties: { id: string, name: string }[];
    roles: Role[];
    departments: Department[];
}

export function UserForm({ user, isEditMode = false, allProperties, roles, departments }: UserFormProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    
    // State
    // const [selectedRole, setSelectedRole] = useState<string>(user?.roleId || "");
    const [selectedProperties, setSelectedProperties] = useState<string[]>(
        user?.managedProperties.map(p => p.id) || []
    );
    const [defaultProp, setDefaultProp] = useState<string>(user?.defaultPropertyId || "");
    const [isActive, setIsActive] = useState<boolean>(user ? user.status === "ACTIVE" : true);

    const toggleProperty = (id: string) => {
        setSelectedProperties(prev => {
            const newSelection = prev.includes(id) 
                ? prev.filter(p => p !== id)
                : [...prev, id];
            
            if (id === defaultProp && prev.includes(id)) {
                setDefaultProp("");
            }
            return newSelection;
        });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        // Append extra fields
        if (defaultProp) formData.set("defaultPropertyId", defaultProp);
        selectedProperties.forEach(id => formData.append("propertyIds", id));
        formData.set("status", isActive ? "ACTIVE" : "INACTIVE");

        startTransition(async () => {
            if (isEditMode && user?.id) {
                const result = await updateUserDetails(user.id, formData);
                if (result.error) {
                    toast.error(result.error);
                } else {
                    toast.success("User updated successfully");
                    router.push("/admin/users");
                }
            } else {
                const result = await createUser(formData);
                if (result.error) {
                    toast.error(result.error);
                } else {
                    toast.success("User created successfully");
                    router.push("/admin/users");
                }
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Main Form Column */}
            <div className="lg:col-span-8 space-y-6">
                
                {/* 1. Basic Information */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <User className="h-4 w-4 text-blue-400" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Basic Information</h3>
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
                                {isEditMode ? "Save Changes" : "Create User"}
                            </Button>
                        </div>
                    </div>
                    <Separator className="bg-white/10" />
                    
                    <div className="grid gap-4 md:grid-cols-2">
                         <div className="space-y-2">
                            <Label className="text-neutral-400">Full Name <span className="text-red-500">*</span></Label>
                            <Input 
                                name="name" 
                                required 
                                defaultValue={user?.name || ""} 
                                disabled={isPending}
                                placeholder="Enter full name"
                                className="bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-blue-500/50"
                            />
                        </div>

                         <div className="space-y-2">
                             <Label className="text-neutral-400">Account Status</Label>
                             <div className="flex items-center justify-between rounded-md border border-white/10 bg-neutral-900/50 p-2 text-sm">
                                <span className={isActive ? "text-white" : "text-neutral-500"}>
                                    {isActive ? "Active Account" : "Inactive Account"}
                                </span>
                                <Switch 
                                    checked={isActive} 
                                    onCheckedChange={setIsActive}
                                    disabled={isPending}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                             </div>
                        </div>

                         <div className="space-y-2">
                            <Label className="text-neutral-400">Email Address</Label>
                            <Input 
                                name="email" 
                                type="email"
                                required 
                                defaultValue={user?.email || ""} 
                                disabled={isPending}
                                placeholder="Enter email address"
                                className="bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-600"
                            />
                        </div>
                         
                        <div className="space-y-2">
                            <Label className="text-neutral-400">Password {!isEditMode ? <span className="text-red-500">*</span> : "(Opt)"}</Label>
                            <Input 
                                name="password" 
                                type="password"
                                required={!isEditMode}
                                disabled={isPending}
                                placeholder={isEditMode ? "Leave blank to keep" : "Min 6 characters"}
                                className="bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-600"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Organization & Roles */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 text-white">
                        <Building2 className="h-4 w-4 text-amber-400" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider">Access Control</h3>
                    </div>
                    <Separator className="bg-white/10" />

                    <div className="grid gap-6 md:grid-cols-2">
                         <div className="space-y-2">
                            <Label className="text-neutral-400">Department <span className="text-red-500">*</span></Label>
                            <Select name="departmentId" defaultValue={user?.departmentId || undefined} disabled={isPending}>
                                <SelectTrigger className="bg-neutral-900/50 border-white/10 text-white w-full">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-neutral-400">System Role <span className="text-red-500">*</span></Label>
                             <Select name="roleId" defaultValue={user?.roleId || undefined} disabled={isPending} required>
                                <SelectTrigger className="bg-neutral-900/50 border-white/10 text-white w-full">
                                    <SelectValue placeholder="Select system role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(r => (
                                        <SelectItem key={r.id} value={r.id}>
                                            <span>{r.name}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                         {/* Business Unit Access (Compact) */}
                         <div className="space-y-3 md:col-span-2 pt-2">
                             <Label className="text-neutral-400">Business Unit Access</Label>
                             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                 {allProperties.map(property => {
                                     const isSelected = selectedProperties.includes(property.id);
                                     return (
                                        <div 
                                            key={property.id} 
                                            onClick={() => !isPending && toggleProperty(property.id)}
                                            className={`
                                                cursor-pointer rounded-md border p-2 text-xs font-medium transition-all select-none
                                                flex items-center justify-center text-center h-12
                                                ${isSelected 
                                                    ? "bg-blue-600/20 border-blue-500/50 text-blue-100" 
                                                    : "bg-neutral-900/50 border-white/5 text-neutral-400 hover:border-white/20 hover:bg-white/5"}
                                            `}
                                        >
                                            {property.name}
                                        </div>
                                     );
                                 })}
                             </div>
                             <p className="text-[10px] text-neutral-500 text-right">
                                Selected: {selectedProperties.length} properties
                             </p>
                        </div>
                    </div>
                </div>

                {/* Hidden Roles Section (Merged above) */}

            </div>

            {/* Sidebar Guide Column */}
            <div className="lg:col-span-4 space-y-6 ">
                <div className="flex items-center gap-2 text-white mb-4 mt-10">
                    <Info className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Quick Guide</h3>
                </div>

                {/* Blue Card: Required Fields */}
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                    <h4 className="text-blue-400 font-medium text-sm mb-2">Required Fields</h4>
                    <ul className="text-xs text-neutral-400 space-y-1 list-disc list-inside">
                        <li>Full Name</li>
                        <li>Email Address</li>
                        <li>Password (Min 6 characters)</li>
                        <li>Department</li>
                        <li>System Role</li>
                    </ul>
                </div>

                {/* Green Card: System Roles */}
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <h4 className="text-emerald-400 font-medium text-sm mb-2">System Roles</h4>
                    <div className="space-y-2">
                        {roles.slice(0, 4).map(r => (
                            <div key={r.id} className="text-xs">
                                <span className="text-white font-medium block">{r.name}</span>
                                <span className="text-neutral-500">{r.description || "No description"}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-xs text-neutral-500 italic block">
                        + Custom roles available
                    </div>
                </div>

                 {/* Purple Card: Permissions */}
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                    <h4 className="text-purple-400 font-medium text-sm mb-2">System Permissions</h4>
                    <p className="text-xs text-neutral-400">
                        Permissions are determined by the selected <strong>System Role</strong>. 
                        To grant specific granular access, create a new Custom Role in the Roles settings.
                    </p>
                </div>
            </div>
        </form>
    );
}
