import { PropertyForm } from "@/components/admin/property-form";

export default function NewPropertyPage() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create Property</h1>
        <p className="text-sm text-neutral-400">Add a new location to your portfolio</p>
      </div>

      <PropertyForm />
    </div>
  );
}
