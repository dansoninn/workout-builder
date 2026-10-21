"use client";

import { ChevronDownIcon, CopyIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export { ThemeToggle };

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "head_coach", label: "Head coach" },
  { value: "coach", label: "Coach" },
  { value: "viewer", label: "Viewer" },
];

/** Interactive components, in the current theme. */
export function InteractiveDemos() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dialog>
        <DialogTrigger render={<Button variant="outline" />}>Invite member…</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>They get a link that only works for this email address.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="demo-email">Email</Label>
              <Input id="demo-email" type="email" placeholder="anna@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select items={ROLES} defaultValue="coach">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <DialogClose render={<Button />} onClick={() => toast.success("Invitation link copied")}>
              <CopyIcon /> Create and copy link
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          Daniel <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuItem>
            <UserIcon /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <SettingsIcon /> Settings <DropdownMenuShortcut>G S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <LogOutIcon /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger render={<Button variant="secondary" />}>Hover or focus me</TooltipTrigger>
        <TooltipContent>
          Open the command palette <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </TooltipContent>
      </Tooltip>

      <Button variant="outline" onClick={() => toast("Saved", { description: "Workout saved · 202 AU" })}>
        Show a toast
      </Button>
    </div>
  );
}
