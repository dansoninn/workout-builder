"use client";

import { CopyIcon, UserPlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { ReadOnlyNote, SettingsSection } from "@/components/app/settings";
import { FormError, SubmitButton, TextField } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Role, roleLabel, ROLES } from "@/lib/permissions";

import {
  cancelInvitation,
  changeRole,
  createInvitation,
  type InviteState,
  removeMember,
  renewInvitation,
} from "./actions";

export type Member = { userId: string; name: string; email: string | null; role: Role; joined: string; isYou: boolean };
export type Invite = { id: string; email: string; role: Role; invited: string; expiresInDays: number };

const ROLE_ITEMS = ROLES.map((r) => ({ value: r.value, label: r.label }));

type MemberChange = { type: "role"; userId: string; role: Role } | { type: "remove"; userId: string };

export function MembersManager({
  slug,
  gymName,
  canManage,
  members,
  invites,
}: {
  slug: string;
  gymName: string;
  canManage: boolean;
  members: Member[];
  invites: Invite[];
}) {
  const [shownMembers, changeMember] = useOptimistic(members, (state, change: MemberChange) =>
    change.type === "remove"
      ? state.filter((m) => m.userId !== change.userId)
      : state.map((m) => (m.userId === change.userId ? { ...m, role: change.role } : m)),
  );
  const [shownInvites, dropInvite] = useOptimistic(invites, (state, id: string) => state.filter((i) => i.id !== id));
  const [, startTransition] = useTransition();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteKey, setInviteKey] = useState(0); // a fresh form each time the dialog opens
  const [shared, setShared] = useState<{ link: string; email: string } | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  // ⌘K → "Invite a member" arrives as ?invite=1.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inviteRequested = canManage && searchParams.has("invite");
  const setInviteDialog = (open: boolean) => {
    if (open) setInviteKey((k) => k + 1);
    setInviteOpen(open);
    if (!open && inviteRequested) router.replace(pathname, { scroll: false });
  };

  const owners = shownMembers.filter((m) => m.role === "owner").length;
  const isLastOwner = (m: Member) => m.role === "owner" && owners === 1;

  const onRoleChange = (member: Member, role: Role) =>
    startTransition(async () => {
      changeMember({ type: "role", userId: member.userId, role });
      const result = await changeRole(slug, member.userId, role);
      if (result.ok) toast.success(`${member.name} is now ${roleLabel(role).toLowerCase()}`);
      else toast.error(result.error);
    });

  const onRemove = (member: Member) =>
    startTransition(async () => {
      setRemoving(null);
      changeMember({ type: "remove", userId: member.userId });
      const result = await removeMember(slug, member.userId);
      if (result.ok) toast.success(`${member.name} was removed from ${gymName}`);
      else toast.error(result.error);
    });

  const onRenew = (invite: Invite) =>
    startTransition(async () => {
      const result = await renewInvitation(slug, invite.id);
      if (result.ok) setShared({ link: result.link, email: result.email });
      else toast.error(result.error);
    });

  const onCancel = (invite: Invite) =>
    startTransition(async () => {
      dropInvite(invite.id);
      const result = await cancelInvitation(slug, invite.id);
      if (result.ok) toast.success(`Invitation for ${invite.email} cancelled`);
      else toast.error(result.error);
    });

  return (
    <div className="grid grid-cols-1 gap-10">
      <SettingsSection
        title="Members"
        description={`${shownMembers.length} ${shownMembers.length === 1 ? "person" : "people"} in ${gymName}.`}
        action={
          canManage && (
            <Button onClick={() => setInviteDialog(true)}>
              <UserPlusIcon /> Invite member
            </Button>
          )
        }
      >
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                {canManage && <TableHead>Email</TableHead>}
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                {canManage && (
                  <TableHead className="w-0">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownMembers.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">
                    {m.name}
                    {m.isYou && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
                  </TableCell>
                  {canManage && <TableCell className="text-muted-foreground">{m.email}</TableCell>}
                  <TableCell>
                    {canManage ? (
                      <Select
                        items={ROLE_ITEMS}
                        value={m.role}
                        onValueChange={(role) => role && role !== m.role && onRoleChange(m, role as Role)}
                        disabled={isLastOwner(m)}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-32"
                          aria-label={`Role of ${m.name}`}
                          title={isLastOwner(m) ? "A gym must keep at least one owner" : undefined}
                        >
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
                    ) : (
                      roleLabel(m.role)
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular sm:table-cell">{m.joined}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoving(m)}
                        disabled={isLastOwner(m)}
                        aria-label={m.isYou ? `Leave ${gymName}` : `Remove ${m.name}`}
                      >
                        {m.isYou ? "Leave" : "Remove"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!canManage && <ReadOnlyNote>Only the gym&apos;s owners can invite people or change roles.</ReadOnlyNote>}
      </SettingsSection>

      {canManage && (
        <SettingsSection
          title="Pending invitations"
          description="Links you've shared that haven't been used yet. Each works once, for 14 days, for that email only."
        >
          {shownInvites.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">
              No pending invitations.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden sm:table-cell">Invited</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownInvites.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.email}</TableCell>
                      <TableCell>{roleLabel(i.role)}</TableCell>
                      <TableCell className="hidden text-muted-foreground tabular sm:table-cell">{i.invited}</TableCell>
                      <TableCell className="tabular">
                        {i.expiresInDays > 0 ? (
                          <span className="text-muted-foreground">
                            in {i.expiresInDays} {i.expiresInDays === 1 ? "day" : "days"}
                          </span>
                        ) : (
                          <Badge variant="outline" className="border-warning text-warning">
                            Expired
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onRenew(i)} aria-label={`New link for ${i.email}`}>
                            New link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCancel(i)}
                            aria-label={`Cancel invitation for ${i.email}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SettingsSection>
      )}

      {canManage && (
        <InviteDialog
          key={inviteKey}
          slug={slug}
          gymName={gymName}
          open={inviteOpen || inviteRequested}
          onOpenChange={setInviteDialog}
          onCreated={(link, email) => {
            setInviteDialog(false);
            setShared({ link, email });
          }}
        />
      )}
      <ShareLinkDialog shared={shared} gymName={gymName} onClose={() => setShared(null)} />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{removing?.isYou ? `Leave ${gymName}?` : `Remove ${removing?.name}?`}</DialogTitle>
            <DialogDescription>
              {removing?.isYou
                ? "You lose access to this gym right away. An owner can invite you again."
                : `${removing?.name} loses access to ${gymName} right away. Their past work stays. You can invite them again later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Keep</DialogClose>
            <Button variant="destructive" onClick={() => removing && onRemove(removing)}>
              {removing?.isYou ? "Leave gym" : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteDialog({
  slug,
  gymName,
  open,
  onOpenChange,
  onCreated,
}: {
  slug: string;
  gymName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (link: string, email: string) => void;
}) {
  const roleId = useId();
  const [state, action] = useActionState(async (prev: InviteState, formData: FormData) => {
    const result = await createInvitation(slug, prev, formData);
    if (result.ok && result.link && result.email) onCreated(result.link, result.email);
    return result.ok ? {} : result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {gymName}</DialogTitle>
          <DialogDescription>
            You&apos;ll get a link to send them. It only works for this email address.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4" noValidate>
          <FormError>{state.error}</FormError>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="off"
            autoFocus
            required
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
          />
          <Field data-invalid={state.fieldErrors?.role ? true : undefined} className="gap-1.5">
            <FieldLabel htmlFor={roleId}>Role</FieldLabel>
            <Select name="role" items={ROLE_ITEMS} defaultValue={state.values?.role || "coach"}>
              <SelectTrigger id={roleId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="h-auto py-1.5">
                    <span className="grid">
                      <span>{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.role && <FieldError className="text-xs">{state.fieldErrors.role}</FieldError>}
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <SubmitButton pendingLabel="Creating link…">Create invitation link</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShareLinkDialog({
  shared,
  gymName,
  onClose,
}: {
  shared: { link: string; email: string } | null;
  gymName: string;
  onClose: () => void;
}) {
  const linkId = useId();
  const copy = async () => {
    if (!shared) return;
    try {
      await navigator.clipboard.writeText(shared.link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it yourself.");
    }
  };
  return (
    <Dialog open={shared !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send this link to {shared?.email}</DialogTitle>
          <DialogDescription>
            By message, email or however you usually talk. It works once, for 14 days, and only when they sign in with{" "}
            {shared?.email}. It won&apos;t be shown again; you can always create a new one.
          </DialogDescription>
        </DialogHeader>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={linkId}>Invitation link to {gymName}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id={linkId}
              readOnly
              value={shared?.link ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
              data-testid="invitation-link"
            />
            <Button variant="outline" onClick={copy} autoFocus>
              <CopyIcon /> Copy
            </Button>
          </div>
        </Field>
        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
