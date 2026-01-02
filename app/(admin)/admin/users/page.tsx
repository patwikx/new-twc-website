import { getUsers, getAllRoles, getAllDepartments } from "@/actions/admin/users";
import { hasPermission } from "@/lib/auth-checks";
import { UsersTable } from "@/components/admin/users-table";

export default async function AdminUsersPage() {
  const users = await getUsers();
  const roles = await getAllRoles();
  const departments = await getAllDepartments();
  
  const canEdit = await hasPermission("users:edit");
  const canDelete = await hasPermission("users:delete");

  return (
    <div className="space-y-4">
       <div>
         <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
         <p className="text-muted-foreground">Manage users, roles, and permissions</p>
       </div>

       <UsersTable 
          users={users} 
          roles={roles}
          departments={departments}
          canEdit={canEdit} 
          canDelete={canDelete} 
       />
    </div>
  );
}
