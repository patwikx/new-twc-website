"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createSupplier, updateSupplier } from "@/lib/inventory/supplier";
import { Loader2, Truck, User, Mail, Phone, MapPin } from "lucide-react";

interface SupplierFormProps {
  supplier?: {
    id: string;
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    isActive: boolean;
  };
  isEditMode?: boolean;
}

export function SupplierForm({
  supplier,
  isEditMode = false,
}: SupplierFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;
    const contactName = formData.get("contactName") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;

    startTransition(async () => {
      let result;

      if (isEditMode && supplier?.id) {
        result = await updateSupplier(supplier.id, {
          name,
          contactName: contactName || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
        });
      } else {
        result = await createSupplier({
          name,
          contactName: contactName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
        });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Supplier updated" : "Supplier created");
        if (!isEditMode && result.data) {
          router.push(`/admin/inventory/suppliers/${result.data.id}`);
        }
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            {isEditMode ? "Supplier Details" : "Create New Supplier"}
          </h2>
          <p className="text-sm text-neutral-400">
            {isEditMode
              ? "Update supplier information and contact details."
              : "Add a new supplier to your vendor list."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            type="button"
            onClick={() => router.back()}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-orange-600 hover:bg-orange-700 text-white min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create Supplier"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Basic Information */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <Truck className="h-4 w-4 text-orange-500" />
            Basic Information
          </Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Supplier Name *
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={supplier?.name}
                placeholder="e.g. ABC Food Distributors"
                required
                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="contactName"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Contact Person
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  id="contactName"
                  name="contactName"
                  defaultValue={supplier?.contactName ?? ""}
                  placeholder="e.g. John Smith"
                  className="pl-10 bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                />
              </div>
            </div>

            {isEditMode && supplier && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Status
                </Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      supplier.isActive ? "bg-green-500" : "bg-neutral-500"
                    }`}
                  />
                  <span className="text-sm text-neutral-300">
                    {supplier.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Use the list page to activate/deactivate suppliers.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-6">
          <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
            <Mail className="h-4 w-4 text-orange-500" />
            Contact Information
          </Label>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={supplier?.email ?? ""}
                  placeholder="e.g. orders@supplier.com"
                  className="pl-10 bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="phone"
                className="text-xs text-neutral-500 uppercase tracking-widest"
              >
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={supplier?.phone ?? ""}
                  placeholder="e.g. +63 912 345 6789"
                  className="pl-10 bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="space-y-6">
        <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
          <MapPin className="h-4 w-4 text-orange-500" />
          Address
        </Label>

        <div className="space-y-2">
          <Label
            htmlFor="address"
            className="text-xs text-neutral-500 uppercase tracking-widest"
          >
            Full Address
          </Label>
          <Textarea
            id="address"
            name="address"
            defaultValue={supplier?.address ?? ""}
            placeholder="Enter the supplier's full address..."
            rows={3}
            className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 resize-none"
          />
        </div>
      </div>
    </form>
  );
}
