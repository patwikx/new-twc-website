"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-checks";
// import { UserRole } from "@prisma/client"; // Deprecated use relations
import bcrypt from "bcryptjs";
import { RegisterSchema } from "@/schemas"; 
// We will use RegisterSchema or a similar custom schema for validation
// For now, I'll inline basic validation or reuse schemas if available.

export async function createUser(formData: FormData) {
  await requirePermission("users:edit"); 

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  
  // New Schema fields
  const roleId = formData.get("roleId") as string;
  const departmentId = formData.get("departmentId") as string;
  const status = formData.get("status") as string; // ACTIVE / INACTIVE

  const defaultPropertyId = formData.get("defaultPropertyId") as string;
  
  if (!email || !password || !name) {
      return { error: "Missing required fields" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) return { error: "Email already in use" };

      await db.user.create({
          data: {
              name,
              email,
              password: hashedPassword,
              // Use roleId relation
              roleId: roleId || undefined, 
              // Keep legacy for now if needed, or default to GUEST
              // role: "GUEST", 
              departmentId: departmentId || undefined,
              status: status || "ACTIVE",
              
              emailVerified: new Date(),
              managedProperties: {
                  connect: formData.getAll("propertyIds").map((id) => ({ id: id as string }))
              },
              defaultPropertyId: defaultPropertyId || null,
          }
      });

      revalidatePath("/admin/users");
      return { success: "User created successfully" };
  } catch (error) {
      console.error("Create User Error:", error);
      return { error: "Failed to create user" };
  }
}

export async function updateUserDetails(userId: string, formData: FormData) {
    await requirePermission("users:edit");

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;
    const nationality = formData.get("nationality") as string;
    const defaultPropertyId = formData.get("defaultPropertyId") as string;
    
    // RBAC fields
    const roleId = formData.get("roleId") as string;
    const departmentId = formData.get("departmentId") as string;
    const status = formData.get("status") as string;

    // Get all property IDs selected
    const propertyIds = formData.getAll("propertyIds") as string[];

    try {
        await db.user.update({
            where: { id: userId },
            data: {
                name,
                email,
                phone,
                address,
                nationality,
                defaultPropertyId: defaultPropertyId || null,
                
                roleId: roleId || null, // Can simplify role update here
                departmentId: departmentId || null,
                status: status || "ACTIVE",

                // Update managed properties relationships
                managedProperties: {
                    set: propertyIds.map(id => ({ id })) 
                    // 'set' replaces all existing connections with the new list
                }
            }
        });
        
        revalidatePath("/admin/users");
        revalidatePath(`/admin/users/${userId}`);
        return { success: "User updated successfully" };
    } catch (error) {
        console.error("Update User Error:", error);
        return { error: "Failed to update user" };
    }
}

export async function getUserById(userId: string) {
    await requirePermission("users:view");
    return await db.user.findUnique({ 
        where: { id: userId },
        include: {
            userRole: true,
            department: true,
            managedProperties: {
                select: { id: true, name: true }
            }
        }
    });
}

export async function getAllPropertiesChoice() {
    // Helper to get properties for the dropdown
    await requirePermission("properties:view");
    return await db.property.findMany({
        select: { id: true, name: true }
    });
}

// Updated to take roleId (String) instead of Enum
export async function updateUserRole(userId: string, roleId: string) {
  await requirePermission("users:edit");

  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { roleId: roleId }
    });

    revalidatePath("/admin/users");
    return { success: "User role updated successfully." };
  } catch (error) {
    console.error("Failed to update user role:", error);
    return { error: "Failed to update role." };
  }
}

export async function getAllRoles() {
    await requirePermission("users:view");
    return await db.role.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function getAllDepartments() {
    await requirePermission("users:view");
    return await db.department.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function deleteUser(userId: string) {
  await requirePermission("users:delete");

  try {
    await db.user.delete({
      where: { id: userId }
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/guests");
    return { success: "User deleted successfully." };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return { error: "Failed to delete user." };
  }
}

export async function getUsers() {
    await requirePermission("users:view");
    
    return await db.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            userRole: true,    // Include dynamic role
            department: true,  // Include department
        }
    });
}
