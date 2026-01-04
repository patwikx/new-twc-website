import { SupplierForm } from "@/components/admin/inventory/supplier-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function NewSupplierPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6">
      <SupplierForm isEditMode={false} />
    </div>
  );
}
