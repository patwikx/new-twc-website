"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-checks";

export async function createRole(formData: FormData) {
    await requirePermission("settings:manage");

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const permissions = formData.getAll("permissions") as string[];

    if (!name) {
        return { error: "Role name is required" };
    }

    try {
        const existingRole = await db.role.findUnique({ where: { name } });
        if (existingRole) return { error: "Role name already exists" };

        await db.role.create({
            data: {
                name,
                description,
                permissions,
                isSystem: false,
            }
        });

        revalidatePath("/admin/roles");
        return { success: "Role created successfully" };
    } catch (error) {
        console.error("Create Role Error:", error);
        return { error: "Failed to create role" };
    }
}

export async function updateRole(roleId: string, formData: FormData) {
    await requirePermission("settings:manage");

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const permissions = formData.getAll("permissions") as string[];

    try {
        // Prevent modifying system role names to avoid breaking code that relies on them
        const currentRole = await db.role.findUnique({ where: { id: roleId } });
        if (currentRole?.isSystem && currentRole.name !== name) {
            return { error: "Cannot change the name of a system role." };
        }

        await db.role.update({
            where: { id: roleId },
            data: {
                name,
                description,
                permissions,
            }
        });

        revalidatePath("/admin/roles");
        return { success: "Role updated successfully" };
    } catch (error) {
        console.error("Update Role Error:", error);
        return { error: "Failed to update role" };
    }
}

export async function deleteRole(roleId: string) {
    await requirePermission("settings:manage");

    try {
        const role = await db.role.findUnique({ where: { id: roleId } });
        if (role?.isSystem) {
            return { error: "Cannot delete system roles." };
        }

        await db.role.delete({ where: { id: roleId } });
        
        revalidatePath("/admin/roles");
        return { success: "Role deleted successfully" };
    } catch (error) {
        console.error("Delete Role Error:", error);
        return { error: "Failed to delete role" };
    }
}

export async function getRoles() {
    await requirePermission("users:view");
    return await db.role.findMany({
        orderBy: { name: 'asc' },
        include: {
           _count: {
             select: { users: true }
           }
        }
    });
}

export async function getRoleById(id: string) {
    await requirePermission("users:view");
    return await db.role.findUnique({
        where: { id }
    });
}
