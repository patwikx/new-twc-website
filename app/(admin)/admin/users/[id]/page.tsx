import { UserForm } from "@/components/admin/UserForm";
// import { ArrowLeft } from "lucide-react"; 
// import Link from "next/link";
// import { Button } from "@/components/ui/button";
import { getUserById, getAllPropertiesChoice, getAllRoles, getAllDepartments } from "@/actions/admin/users";
import { redirect } from "next/navigation";

interface EditUserPageProps {
    params: Promise<{
        id: string;
    }>
}

export default async function EditUserPage(props: EditUserPageProps) {
  const params = await props.params;
  const user = await getUserById(params.id);
  const allProperties = await getAllPropertiesChoice();
  const roles = await getAllRoles();
  const departments = await getAllDepartments();

  if (!user) {
      redirect("/admin/users");
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Edit User</h1>
        <p className="text-sm text-neutral-400">Update user details and permissions</p>
      </div>

      <UserForm 
        user={user} 
        isEditMode={true} 
        allProperties={allProperties}
        roles={roles}
        departments={departments} 
    />
    </div>
  );
}
