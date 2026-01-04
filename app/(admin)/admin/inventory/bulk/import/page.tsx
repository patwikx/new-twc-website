import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BulkImportForm } from "@/components/admin/inventory/bulk-import-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function BulkImportPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get the first property for now (in a real app, this would come from property context)
  const property = await db.property.findFirst({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  if (!property) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Import</h1>
          <p className="text-muted-foreground">
            No properties found. Please create a property first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <Link href="/admin/inventory/items">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Import</h1>
          <p className="text-muted-foreground">
            Import stock items or update prices in bulk using CSV files
          </p>
        </div>
      </div>

      <BulkImportForm propertyId={property.id} propertyName={property.name} />
    </div>
  );
}
