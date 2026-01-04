"use client";

import { useState, useTransition } from "react";
import { AccessLevel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  UserPlus,
  Shield,
  Eye,
  Settings,
  Check,
  ChevronsUpDown,
  Pencil,
} from "lucide-react";
import { grantWarehouseAccess } from "@/lib/inventory/user-warehouse-access";
import { cn } from "@/lib/utils";

interface AvailableUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface UserAccess {
  id: string;
  userId: string;
  accessLevel: AccessLevel;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  };
}

interface WarehouseAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseName: string;
  availableUsers: AvailableUser[];
  mode: "grant" | "edit";
  currentUser?: UserAccess;
  onUpdateAccess?: (userId: string, newLevel: AccessLevel) => void;
}

const ACCESS_LEVELS: {
  value: AccessLevel;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "VIEW",
    label: "View",
    description: "Read-only access to stock levels and movements",
    icon: <Eye className="h-4 w-4 text-blue-400" />,
  },
  {
    value: "MANAGE",
    label: "Manage",
    description: "Can perform stock receipts, transfers, adjustments, and requisitions",
    icon: <Settings className="h-4 w-4 text-amber-400" />,
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full access including user access management",
    icon: <Shield className="h-4 w-4 text-green-400" />,
  },
];


export function WarehouseAccessDialog({
  open,
  onOpenChange,
  warehouseId,
  warehouseName,
  availableUsers,
  mode,
  currentUser,
  onUpdateAccess,
}: WarehouseAccessDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel>(
    currentUser?.accessLevel || "VIEW"
  );
  const [userSelectOpen, setUserSelectOpen] = useState(false);

  const selectedUser = availableUsers.find((u) => u.id === selectedUserId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "grant") {
      if (!selectedUserId) {
        toast.error("Please select a user");
        return;
      }

      startTransition(async () => {
        const result = await grantWarehouseAccess({
          userId: selectedUserId,
          warehouseId,
          accessLevel: selectedAccessLevel,
        });

        if (result.success) {
          toast.success("Access granted successfully");
          onOpenChange(false);
          resetForm();
        } else {
          toast.error(result.error || "Failed to grant access");
        }
      });
    } else if (mode === "edit" && currentUser && onUpdateAccess) {
      onUpdateAccess(currentUser.userId, selectedAccessLevel);
    }
  };

  const resetForm = () => {
    setSelectedUserId("");
    setSelectedAccessLevel("VIEW");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              {mode === "grant" ? (
                <>
                  <UserPlus className="h-5 w-5 text-orange-500" />
                  Grant Warehouse Access
                </>
              ) : (
                <>
                  <Pencil className="h-5 w-5 text-orange-500" />
                  Edit Access Level
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              {mode === "grant"
                ? `Grant a user access to ${warehouseName}`
                : `Change access level for ${currentUser?.user.name || currentUser?.user.email}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* User Selection (Grant mode only) */}
            {mode === "grant" && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  Select User
                </Label>
                <Popover open={userSelectOpen} onOpenChange={setUserSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={userSelectOpen}
                      className="w-full justify-between h-10 bg-neutral-900/50 border-white/10 text-white hover:bg-neutral-800"
                    >
                      {selectedUser ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={selectedUser.image || undefined} />
                            <AvatarFallback className="bg-neutral-700 text-xs">
                              {(selectedUser.name || "U")
                                .substring(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{selectedUser.name || selectedUser.email}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500">Select a user...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-neutral-900 border-white/10">
                    <Command className="bg-transparent">
                      <CommandInput
                        placeholder="Search users..."
                        className="border-white/10"
                      />
                      <CommandList>
                        <CommandEmpty className="text-neutral-400 py-6 text-center text-sm">
                          No users found.
                        </CommandEmpty>
                        <CommandGroup>
                          {availableUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.name || ""} ${user.email || ""}`}
                              onSelect={() => {
                                setSelectedUserId(user.id);
                                setUserSelectOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={user.image || undefined} />
                                  <AvatarFallback className="bg-neutral-700 text-xs">
                                    {(user.name || "U")
                                      .substring(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="text-sm text-white">
                                    {user.name || "Unnamed User"}
                                  </span>
                                  <span className="text-xs text-neutral-400">
                                    {user.email}
                                  </span>
                                </div>
                              </div>
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  selectedUserId === user.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {availableUsers.length === 0 && (
                  <p className="text-xs text-amber-400">
                    All users already have access to this warehouse.
                  </p>
                )}
              </div>
            )}

            {/* Current User Display (Edit mode only) */}
            {mode === "edit" && currentUser && (
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                  User
                </Label>
                <div className="flex items-center gap-3 p-3 rounded-md bg-neutral-800/50 border border-white/10">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentUser.user.image || undefined} />
                    <AvatarFallback className="bg-neutral-700">
                      {(currentUser.user.name || "U")
                        .substring(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">
                      {currentUser.user.name || "Unnamed User"}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {currentUser.user.email}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Access Level Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                Access Level
              </Label>
              <Select
                value={selectedAccessLevel}
                onValueChange={(v) => setSelectedAccessLevel(v as AccessLevel)}
              >
                <SelectTrigger className="h-10 bg-neutral-900/50 border-white/10 focus:border-orange-500/50">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-white/10">
                  {ACCESS_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div className="flex items-center gap-2">
                        {level.icon}
                        <span>{level.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Access Level Description */}
            <div className="space-y-2">
              <Label className="text-xs text-neutral-500 uppercase tracking-widest">
                Permissions
              </Label>
              <div className="space-y-2">
                {ACCESS_LEVELS.map((level) => {
                  const isSelected = selectedAccessLevel === level.value;
                  return (
                    <div
                      key={level.value}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-md border transition-colors",
                        isSelected
                          ? "bg-orange-500/10 border-orange-500/30"
                          : "bg-neutral-900/30 border-white/5"
                      )}
                    >
                      <div className="mt-0.5">{level.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isSelected ? "text-orange-400" : "text-white"
                            )}
                          >
                            {level.label}
                          </span>
                          {isSelected && (
                            <Badge
                              variant="outline"
                              className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]"
                            >
                              Selected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {level.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || (mode === "grant" && !selectedUserId)}
              className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "grant" ? "Granting..." : "Updating..."}
                </>
              ) : mode === "grant" ? (
                "Grant Access"
              ) : (
                "Update Access"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
