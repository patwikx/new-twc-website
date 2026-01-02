import { RoleForm } from "@/components/admin/RoleForm";

export default function CreateRolePage() {
    return (
        <div>
             <div className="mb-6">
                 <h1 className="text-2xl font-bold tracking-tight text-white">Create New Role</h1>
                 <p className="text-neutral-400">Define a new set of permissions for system access.</p>
            </div>
            <RoleForm />
        </div>
    );
}
