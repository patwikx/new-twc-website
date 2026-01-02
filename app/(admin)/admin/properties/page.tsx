import { db } from "@/lib/db";
import { PropertiesTable } from "@/components/admin/properties-table";

export default async function AdminPropertiesPage() {
  const properties = await db.property.findMany({
    include: { _count: { select: { rooms: true } } }
  });

  return (
    <div className="space-y-4">
       <div>
         <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
         <p className="text-muted-foreground">Manage your hotel locations and details.</p>
       </div>

       <PropertiesTable properties={properties} />
    </div>
  );
}
