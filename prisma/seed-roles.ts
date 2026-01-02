
import { PrismaClient, UserRole } from "@prisma/client";
import { ROLE_PERMISSIONS } from "@/lib/permissions"; 

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Roles & Departments...");

  // 1. Create Default Departments
  const depts = ["Executive", "Operations", "Finance", "HR", "IT", "Marketing"];
  for (const name of depts) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("✅ Departments created.");

  // 2. Create System Roles
  // Map our existing Enum roles to new Dynamic Roles
  const rolesToCreate = [
    {
      name: "Super Admin",
      description: "Full system access. Cannot be deleted.",
      isSystem: true,
      permissions: ROLE_PERMISSIONS.ADMIN, // Use existing permissions list
      legacyRole: "ADMIN",
    },
    {
      name: "Staff",
      description: "Standard employee access.",
      isSystem: true,
      permissions: ROLE_PERMISSIONS.STAFF,
      legacyRole: "STAFF",
    },
    {
      name: "Guest",
      description: "External user / Customer.",
      isSystem: true,
      permissions: ROLE_PERMISSIONS.GUEST,
      legacyRole: "GUEST",
    },
    {
        name: "Manager",
        description: "Team lead with approval capabilities.",
        isSystem: false,
        permissions: [...ROLE_PERMISSIONS.STAFF, "users:view", "reports:view"], // Example extended permissions
        legacyRole: null
    }
  ];

  for (const r of rolesToCreate) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {
        permissions: r.permissions, // Update permissions if they changed in code
      },
      create: {
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: r.permissions,
      },
    });

    // 3. Migrate Users
    if (r.legacyRole) {
        console.log(`Migrating users with legacy role ${r.legacyRole} to ${r.name}...`);
        const result = await prisma.user.updateMany({
            where: { 
                role: r.legacyRole as UserRole,
                roleId: null // Only update if not already assigned
            },
            data: {
                roleId: role.id
            }
        });
        console.log(`Updated ${result.count} users to ${r.name}.`);
    }
  }

  console.log("✅ Roles seeded and users migrated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
