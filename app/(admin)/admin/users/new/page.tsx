import { UserForm } from "@/components/admin/UserForm";
// import { ArrowLeft } from "lucide-react"; 
// import Link from "next/link";
// import { Button } from "@/components/ui/button";
import { getAllPropertiesChoice, getAllRoles, getAllDepartments } from "@/actions/admin/users";

export default async function NewUserPage() {
  const allProperties = await getAllPropertiesChoice();
  const roles = await getAllRoles();
  const departments = await getAllDepartments();

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create New User</h1>
        <p className="text-sm text-neutral-400">Add a new user to the system manually</p>
      </div>

      <UserForm 
        isEditMode={false} 
        allProperties={allProperties}  
        user={null}
        roles={roles}
        departments={departments}
      />
    </div>
  );
}
