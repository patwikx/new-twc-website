"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createRoom, updateRoom } from "@/actions/admin/rooms";
import { Loader2, Home, Users, DollarSign, ImageIcon, UploadCloud } from "lucide-react";
import { FileUpload } from "@/components/file-upload";

interface RoomFormProps {
    room?: {
        id: string;
        name: string;
        propertyId: string;
        description: string;
        capacity: number;
        price: number;
        image: string | null;
    } | null;
    isEditMode?: boolean;
    properties: { id: string, name: string }[];
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function RoomForm({ room, isEditMode = false, properties, onSuccess, onCancel }: RoomFormProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const [selectedProperty, setSelectedProperty] = useState<string>(
        room?.propertyId || (properties.length > 0 ? properties[0].id : "")
    );
    const [imageUrl, setImageUrl] = useState<string>(room?.image || "");
    const [isReplacingImage, setIsReplacingImage] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        if (selectedProperty) {
            formData.set("propertyId", selectedProperty);
        }
        formData.set("image", imageUrl);

        startTransition(async () => {
            let result;
            if (isEditMode && room?.id) {
                result = await updateRoom(room.id, formData);
            } else {
                result = await createRoom(formData);
            }

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(isEditMode ? "Room updated" : "Room created");
                if (onSuccess) {
                    onSuccess();
                } else if (!isEditMode) {
                    router.push("/admin/rooms");
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
             {/* Header Section (Unified) */}
             <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-xl font-semibold text-white mb-1">
                        {isEditMode ? "Edit Room Details" : "Create Room Type"}
                    </h2>
                    <p className="text-sm text-neutral-400">
                        {isEditMode 
                            ? "Update configuration for this room type." 
                            : "Add a new room category."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                     {onCancel && (
                        <Button 
                            variant="ghost" 
                            type="button" 
                            onClick={onCancel} 
                            className="text-neutral-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                    )}
                    <Button 
                        type="submit" 
                        disabled={isPending}
                        className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            isEditMode ? "Save Changes" : "Create Room"
                        )}
                    </Button>
                </div>
            </div>

            <div className="space-y-8">
                 {/* Top Section: Basic Info & Image */}
                 <div className="space-y-6">
                    <div className="grid gap-6">
                        <div className="space-y-4">
                            <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
                                <Home className="h-4 w-4 text-orange-500" />
                                Basic Details
                            </Label>
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-xs text-neutral-500 uppercase tracking-widest">Room Name</Label>
                                    <Input 
                                        id="name" 
                                        name="name" 
                                        defaultValue={room?.name} 
                                        placeholder="e.g. Deluxe Ocean View" 
                                        required 
                                        className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="propertyId" className="text-xs text-neutral-500 uppercase tracking-widest">Property</Label>
                                    <Select 
                                        name="propertyId" 
                                        value={selectedProperty} 
                                        onValueChange={setSelectedProperty}
                                        required
                                    >
                                        <SelectTrigger className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20">
                                            <SelectValue placeholder="Select property" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {properties.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                         <div className="space-y-4">
                            <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
                                <ImageIcon className="h-4 w-4 text-orange-500" />
                                Room Image
                            </Label>
                            <div className="min-h-[200px] border border-dashed border-white/20 rounded-xl bg-neutral-900/30 overflow-hidden relative group transition-colors hover:border-white/30">
                                {imageUrl && !isReplacingImage ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                            src={imageUrl} 
                                            alt="Room preview" 
                                            className="w-full h-full object-cover min-h-[200px]"
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
                                            className="w-full h-full min-h-[200px]"
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
                        </div>
                    </div>
                 </div>

                 {/* Middle Section: Capacity & Pricing */}
                 <div className="space-y-4">
                    <Label className="flex items-center gap-2 text-sm font-medium text-neutral-300 border-b border-white/10 pb-2">
                         <Users className="h-4 w-4 text-orange-500" />
                         Capacity & Pricing
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label htmlFor="capacity" className="text-xs text-neutral-500 uppercase tracking-widest">Max Guests</Label>
                             <Input 
                                id="capacity" 
                                name="capacity" 
                                type="number"
                                min="1"
                                defaultValue={room?.capacity || 2} 
                                required 
                                className="bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                             />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="price" className="text-xs text-neutral-500 uppercase tracking-widest">Price / Night</Label>
                             <div className="relative">
                                <span className="absolute left-3 top-2.5 text-neutral-500">₱</span>
                                <Input 
                                    id="price" 
                                    name="price" 
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={room?.price} 
                                    placeholder="0.00"
                                    required 
                                    className="pl-7 bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                                />
                             </div>
                        </div>
                    </div>
                 </div>

                 {/* Bottom Section: Description */}
                 <div className="space-y-4">
                    <Label className="text-sm font-medium text-neutral-300 border-b border-white/10 pb-2 block">
                        Description
                    </Label>
                    <Textarea 
                        id="description" 
                        name="description" 
                        defaultValue={room?.description} 
                        placeholder="Describe the room features and amenities..." 
                        className="h-32 resize-none bg-neutral-900/30 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20"
                    />
                 </div>
            </div>
        </form>
    );
}
