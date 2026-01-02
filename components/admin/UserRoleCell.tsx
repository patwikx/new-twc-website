"use client";

import { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateUserRole } from "@/actions/admin/users";

interface UserRoleCellProps {
    userId: string;
    currentRole: UserRole;
}

export function UserRoleCell({ userId, currentRole }: UserRoleCellProps) {
    const [role, setRole] = useState<UserRole>(currentRole);
    const [isPending, startTransition] = useTransition();

    const handleRoleChange = (newRole: UserRole) => {
        setRole(newRole); // Optimistic update
        
        startTransition(async () => {
            const result = await updateUserRole(userId, newRole);
            if (result.error) {
                toast.error(result.error);
                setRole(currentRole); // Revert
            } else {
                toast.success("User role updated");
            }
        });
    };

    return (
        <Select 
            value={role} 
            onValueChange={(val) => handleRoleChange(val as UserRole)}
            disabled={isPending}
        >
            <SelectTrigger className="h-8 w-[110px] bg-neutral-900 border-white/10 text-xs">
                <SelectValue placeholder="Select Role" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="GUEST">Guest</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
        </Select>
    );
}
