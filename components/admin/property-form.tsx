"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createProperty, updateProperty } from "@/actions/admin/properties";
import { Loader2, Building2, MapPin, ImageIcon, UploadCloud, Facebook } from "lucide-react";
import { FileUpload } from "@/components/file-upload";

interface PropertyFormProps {
    property?: {
        id: string;
        name: string;
        location: string;
        description: string;
        longDescription: string;
        image: string | null;
        facebookPageId: string | null;
        taxRate: number;
        serviceChargeRate: number;
    } | null;
    isEditMode?: boolean;
}

export function PropertyForm({ property, isEditMode = false }: PropertyFormProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [imageUrl, setImageUrl] = useState<string>(property?.image || "");
    const [isReplacingImage, setIsReplacingImage] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("image", imageUrl);

        startTransition(async () => {
            let result;
            if (isEditMode && property?.id) {
                result = await updateProperty(property.id, formData);
            } else {
                result = await createProperty(formData);
            }

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(isEditMode ? "Property updated" : "Property created");
                if (!isEditMode) {
                    router.push("/admin/properties");
                }
                router.refresh();
            }
        });
    };

    const handleUploadComplete = (result: { fileName: string; name: string; fileUrl: string }) => {
        setImageUrl(result.fileUrl);
        setIsReplacingImage(false);
        toast.success("Image uploaded");
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Header Section (Within Form) */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold text-white mb-1">
                        {isEditMode ? "Property Details" : "Create New Property"}
                    </h2>
                    <p className="text-sm text-neutral-400">
                        {isEditMode 
                            ? "Manage main property information and content." 
                            : "Configure configuration for the new property."}
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
                        ) : (
                            isEditMode ? "Save Changes" : "Create Property"
                        )}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left: Cover Image (Visual Anchor) */}
                <div className="w-full lg:w-[350px] space-y-6">
                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                            <ImageIcon className="h-4 w-4 text-orange-500" />
                            Cover Image
                        </Label>
                        
                        <div className="aspect-video border border-dashed border-white/20 rounded-xl bg-neutral-900/30 overflow-hidden relative group transition-colors hover:border-white/30">
                            {imageUrl && !isReplacingImage ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={imageUrl} 
                                        alt="Property cover" 
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-white/20 bg-black/50 hover:bg-white hover:text-black text-white"
                                            onClick={() => setIsReplacingImage(true)}
                                        >
                                            <UploadCloud className="h-4 w-4 mr-2" />
                                            Change Image
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-4">
                                        <FileUpload
                                        onUploadComplete={handleUploadComplete}
                                        onUploadError={(err) => toast.error(err)}
                                        accept=".jpg,.jpeg,.png,.webp,.gif"
                                        maxSize={5}
                                        className="w-full h-full"
                                    />
                                    {isReplacingImage && imageUrl && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => setIsReplacingImage(false)}
                                            className="mt-2 text-neutral-400 hover:text-white"
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-neutral-500">
                            Recommended: 1920x1080px (16:9)
                        </p>
                    </div>
                </div>

                {/* Right: Info & Description */}
                <div className="flex-1 space-y-8">
                    {/* Identity Row */}
                    <div className="space-y-4">
                         <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
                             <Building2 className="h-4 w-4 text-orange-500" />
                             Basic Information
                        </Label>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs text-neutral-500 uppercase tracking-widest">Property Name</Label>
                                <Input 
                                    id="name" 
                                    name="name" 
                                    defaultValue={property?.name} 
                                    placeholder="e.g. Tropicana Hotel" 
                                    required 
                                    className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location" className="text-xs text-neutral-500 uppercase tracking-widest">Location</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                                    <Input 
                                        id="location" 
                                        name="location" 
                                        defaultValue={property?.location} 
                                        placeholder="City, Province" 
                                        className="pl-9 bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="facebookPageId" className="text-xs text-neutral-500 uppercase tracking-widest">Facebook Page ID</Label>
                                <div className="relative">
                                    <Facebook className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                                    <Input 
                                        id="facebookPageId" 
                                        name="facebookPageId" 
                                        defaultValue={property?.facebookPageId || ""} 
                                        placeholder="Numeric ID" 
                                        className="pl-9 bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 w-full md:w-1/2"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Financial Configuration */}
                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
                            <Building2 className="h-4 w-4 text-orange-500" />
                            Financial Configuration
                        </Label>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="taxRate" className="text-xs text-neutral-500 uppercase tracking-widest">Tax Rate (Decimal)</Label>
                                <Input 
                                    id="taxRate" 
                                    name="taxRate" 
                                    type="number"
                                    step="0.0001"
                                    defaultValue={property?.taxRate || 0.12} 
                                    placeholder="0.12" 
                                    required 
                                    className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                                />
                                <p className="text-[10px] text-neutral-500">e.g. 0.12 for 12% VAT</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="serviceChargeRate" className="text-xs text-neutral-500 uppercase tracking-widest">Service Charge Rate (Decimal)</Label>
                                <Input 
                                    id="serviceChargeRate" 
                                    name="serviceChargeRate" 
                                    type="number"
                                    step="0.0001"
                                    defaultValue={property?.serviceChargeRate || 0.10} 
                                    placeholder="0.10" 
                                    required 
                                    className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                                />
                                <p className="text-[10px] text-neutral-500">e.g. 0.10 for 10% Service Charge</p>
                            </div>
                        </div>
                    </div>

                     {/* Content Row */}
                    <div className="space-y-4">
                         <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
                             Content
                        </Label>
                        <div className="space-y-6">
                             <div className="space-y-2">
                                <Label htmlFor="description" className="text-xs text-neutral-500 uppercase tracking-widest">Short Summary</Label>
                                <Textarea 
                                    id="description" 
                                    name="description" 
                                    defaultValue={property?.description} 
                                    placeholder="Brief overview shown in listings..." 
                                    className="h-20 resize-none bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="longDescription" className="text-xs text-neutral-500 uppercase tracking-widest">Full Details</Label>
                                <Textarea 
                                    id="longDescription" 
                                    name="longDescription" 
                                    defaultValue={property?.longDescription} 
                                    placeholder="Comprehensive property description..." 
                                    className="min-h-[150px] bg-neutral-900/30 border-white/10 font-mono text-sm leading-relaxed focus:border-orange-500/50 focus:ring-orange-500/20"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
