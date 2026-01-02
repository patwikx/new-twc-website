import { getRoles } from "@/actions/admin/roles";
import { Button } from "@/components/ui/button";
import { Plus, ShieldCheck, Pencil, Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteRoleButton } from "@/components/admin/DeleteRoleButton"; // Create local component for client-side delete

export default async function AdminRolesPage() {
    const roles = await getRoles();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                     <h1 className="text-3xl font-bold tracking-tight text-white">Roles & Permissions</h1>
                     <p className="text-neutral-400">Manage system roles and access levels.</p>
                </div>
                 <Link href="/admin/roles/new">
                    <Button className="bg-white text-black hover:bg-neutral-200">
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Role
                    </Button>
                </Link>
            </div>

            {roles.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-neutral-800 rounded-lg">
                    <ShieldCheck className="h-10 w-10 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-white">No roles defined</h3>
                    <p className="text-neutral-400 text-sm mt-1 mb-6">Get started by creating a new role.</p>
                    <Link href="/admin/roles/new">
                        <Button variant="secondary">
                            Create First Role
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {roles.map(role => (
                        <Card key={role.id} className="group flex flex-col justify-between border-white/10 bg-neutral-900/40 hover:bg-neutral-900/80 hover:border-white/20 transition-all duration-200">
                             <CardHeader className="p-4 pb-2">
                                 <div className="flex justify-between items-start gap-2">
                                     <div className="space-y-1">
                                         <CardTitle className="text-sm font-semibold text-white flex items-center gap-2 group-hover:text-purple-400 transition-colors">
                                             {role.name}
                                         </CardTitle>
                                     </div>
                                     {role.isSystem ? (
                                         <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-neutral-800 text-neutral-400 border-neutral-700">System</Badge>
                                     ) : (
                                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-purple-500/30 text-purple-400 bg-purple-500/5">Custom</Badge>
                                     )}
                                 </div>
                                 <CardDescription className="text-neutral-400 text-xs line-clamp-2 h-8 pt-1">
                                     {role.description || "No description provided."}
                                 </CardDescription>
                             </CardHeader>
                             
                             <CardContent className="p-4 py-2">
                                 <div className="flex items-center gap-4 text-xs text-neutral-500 font-medium">
                                     <div className="flex items-center gap-1.5">
                                         <ShieldCheck className="h-3.5 w-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                                         {role.permissions.length} Perms
                                     </div>
                                     <div className="w-px h-3 bg-neutral-800" />
                                     <div>
                                         {role._count.users} Users
                                     </div>
                                 </div>
                             </CardContent>

                             <CardFooter className="p-4 pt-2">
                                 {role.isSystem ? (
                                    <div className="w-full flex items-center justify-center h-8 rounded-md bg-white/5 border border-white/5 text-[10px] text-neutral-500 cursor-not-allowed select-none">
                                        <Lock className="mr-1.5 h-3 w-3" />
                                        Locked
                                    </div>
                                 ) : (
                                     <div className="flex items-center gap-2 w-full">
                                         <Link href={`/admin/roles/${role.id}`} className="flex-1">
                                             <Button variant="outline" size="sm" className="w-full h-8 text-xs border-white/10 bg-transparent hover:bg-white/10 hover:text-white hover:border-white/20">
                                                 Edit
                                             </Button>
                                         </Link>
                                         <DeleteRoleButton roleId={role.id} roleName={role.name} />
                                     </div>
                                 )}
                             </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
