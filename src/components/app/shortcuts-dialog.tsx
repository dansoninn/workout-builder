"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SHORTCUT_GROUPS } from "@/lib/navigation";

import { useShell } from "./shell-context";

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useShell();
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press G, then the letter. On Windows, use Ctrl instead of ⌘.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="mb-1.5 text-2xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
              <dl className="grid">
                {group.items.map((item) => (
                  <div key={item.label} className="flex h-8 items-center justify-between gap-4 border-b border-border last:border-0">
                    <dt>{item.label}</dt>
                    <dd className="flex gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
