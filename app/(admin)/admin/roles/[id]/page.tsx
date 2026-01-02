import { getRoleById } from "@/actions/admin/roles";
import { RoleForm } from "@/components/admin/RoleForm";
import { notFound } from "next/navigation";

interface EditRolePageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditRolePage({ params }: EditRolePageProps) {
    const { id } = await params;
    const role = await getRoleById(id);

    if (!role) notFound();

    return (
        <div>
             <div className="mb-6">
                 <h1 className="text-2xl font-bold tracking-tight text-white">Edit Role: {role.name}</h1>
                 <p className="text-neutral-400">Modify permissions and details for this role.</p>
            </div>
            <RoleForm 
                role={{
                    ...role,
                    // Ensure permissions is array of strings (it is String[] in schema)
                }} 
                isEditMode 
            />
        </div>
    );
}
