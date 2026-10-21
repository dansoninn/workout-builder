import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cn } from "cn";

import { Estimate } from "@/components/design/estimate";
import { EffortTag, IntentTag, PatternTag } from "@/components/design/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ENGINE_CONFIG } from "@/lib/engine/config";
import { WOD_1 } from "@/lib/engine/fixtures/worked-wods";
import { estimated, exact } from "@/lib/engine/measure";
import { computeWorkout } from "@/lib/engine/workout";
import { PATTERNS, type PatternKey } from "@/lib/taxonomy";

import { InteractiveDemos, ThemeToggle } from "./demos";

export const metadata: Metadata = { title: "Design system" };

// Shown locally and on preview deployments, never in production.
const SHOW = process.env.VERCEL_ENV !== "production";

const wod1 = computeWorkout(WOD_1, ENGINE_CONFIG);
const blockC = wod1.blocks[2];

const SECTIONS = [
  ["principles", "Principles"],
  ["type", "Typography"],
  ["colour", "Colour"],
  ["semantic", "Semantic colour"],
  ["space", "Space and shape"],
  ["components", "Components"],
  ["numbers", "Honest numbers"],
  ["keyboard", "Keyboard"],
  ["density", "Density"],
] as const;

const TYPE_SCALE = [
  ["text-3xl", "32 / 40", "Rare: empty states", "text-3xl font-semibold"],
  ["text-2xl", "24 / 32", "Key numbers in the load panel", "text-2xl font-semibold"],
  ["text-xl", "20 / 28", "Page titles", "text-xl font-semibold"],
  ["text-lg", "16 / 24", "Section and dialog titles", "text-lg font-semibold"],
  ["text-base", "14 / 22", "Reading text, descriptions", "text-base"],
  ["text-sm", "13 / 20", "Default for the whole interface", "text-sm"],
  ["text-xs", "12 / 16", "Secondary text, table details", "text-xs text-muted-foreground"],
  ["text-2xs", "11 / 16", "Keys, small labels", "text-2xs font-medium tracking-wide text-muted-foreground uppercase"],
] as const;

const COLOUR_GROUPS = [
  ["Surfaces", ["background", "surface", "surface-sunken", "surface-raised", "hover"]],
  ["Text", ["foreground", "muted-foreground", "subtle-foreground", "primary-text"]],
  ["Lines", ["border", "border-strong", "input", "ring"]],
  ["Action", ["primary", "primary-subtle"]],
  ["Status", ["destructive", "warning", "success", "destructive-subtle", "warning-subtle", "success-subtle"]],
] as const;

const KEYS = [
  [["⌘", "K"], "Command palette: go anywhere, do anything", "4a"],
  [["G", "B"], "Go to Builder", "4a"],
  [["G", "C"], "Go to Calendar", "4a"],
  [["G", "A"], "Go to Analytics", "4a"],
  [["G", "E"], "Go to Exercises", "4a"],
  [["G", "S"], "Go to Settings", "4a"],
  [["?"], "Show all shortcuts", "4a"],
  [["⌘", "S"], "Save workout", "4b"],
  [["Enter"], "New line in a block", "4b"],
  [["⌘", "Enter"], "New block", "4b"],
  [["⌥", "↑ ↓"], "Move a line", "4b"],
] as const;

const DENSITY_LINES: [string, string, PatternKey | null][] = [
  ["5", "Kettlebell swing", "hinge"],
  ["10", "Air squat", "squat"],
  ["15", "Double-under", null],
];

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 border-t border-border py-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-2xl text-base text-muted-foreground">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Forces a theme for its subtree, so light and dark can sit side by side. */
function ThemePanel({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div className={cn(theme, "rounded-lg border border-border bg-background p-4 text-foreground")}>
      <p className="mb-3 text-2xs font-medium tracking-wide text-muted-foreground uppercase">{theme}</p>
      {children}
    </div>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-7 shrink-0 rounded-md border border-border" style={{ backgroundColor: `var(--${token})` }} />
      <code className="text-xs text-muted-foreground">--{token}</code>
    </div>
  );
}

export default function DesignPage() {
  if (!SHOW) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-24">
      <header className="sticky top-0 z-10 -mx-6 mb-8 flex items-center gap-4 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <h1 className="text-sm font-semibold">Workout Builder design system</h1>
        <nav aria-label="Sections" className="hidden flex-1 gap-1 overflow-x-auto lg:flex">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-md px-2 py-1 text-xs whitespace-nowrap text-muted-foreground hover:bg-hover hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <span className="ml-auto text-xs text-muted-foreground">Local and preview only</span>
        <ThemeToggle />
      </header>

      <Section id="principles" title="Principles" intro="Decided from how coaches program, not from earlier prototypes. Full text: docs/DESIGN.md.">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Keyboard-first", "A full week can be programmed without the mouse. ⌘K reaches every page and action."],
            ["Instant", "Optimistic updates, no spinners in the builder; the engine runs on the coach's own device."],
            ["Dense but calm", "Lots of information, small readable type, quiet colour that only appears where it means something."],
            ["Honest numbers", "Estimates show ~ and their range; every warning links to the line that causes it."],
            ["One system", "Every colour, size and space comes from the tokens on this page, in light and dark."],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground tabular">0{i + 1}</p>
              <p className="mt-1 font-medium">{title}</p>
              <p className="mt-1 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="type" title="Typography" intro="Geist, with tabular numbers wherever figures line up. The interface runs at 13 px; reading text at 14 px. Two weights do most of the work: regular and medium, semibold for titles.">
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {TYPE_SCALE.map(([token, size, use, cls]) => (
            <div key={token} className="grid grid-cols-[7rem_5rem_1fr] items-baseline gap-4 px-4 py-3 max-sm:grid-cols-1 max-sm:gap-1">
              <code className="text-xs text-muted-foreground">{token}</code>
              <span className="text-xs text-muted-foreground tabular">{size}</span>
              <span className={cn(cls, "truncate")}>{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="colour" title="Colour" intro="OKLCH tokens with a cool neutral base and one action colour. Every text and control pair meets WCAG contrast in both themes; a test checks it on every change.">
        <div className="grid gap-4 md:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => (
            <ThemePanel key={theme} theme={theme}>
              <div className="grid gap-5">
                {COLOUR_GROUPS.map(([group, tokens]) => (
                  <div key={group}>
                    <p className="mb-2 text-xs font-medium">{group}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {tokens.map((t) => (
                        <Swatch key={t} token={t} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="rounded-md border border-border bg-surface p-3">
                  <p>Body text on a surface.</p>
                  <p className="text-muted-foreground">Secondary text explains.</p>
                  <p className="text-subtle-foreground">Placeholders and disabled text.</p>
                  <p className="text-primary-text">A link or a selected item.</p>
                </div>
              </div>
            </ThemePanel>
          ))}
        </div>
      </Section>

      <Section id="semantic" title="Semantic colour" intro="Colour that carries meaning, always with a label next to it. Movement patterns: lower body warm, upper body cool, core violet, carries stone.">
        <div className="grid gap-4 md:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => (
            <ThemePanel key={theme} theme={theme}>
              <div className="grid gap-4">
                <div>
                  <p className="mb-2 text-xs font-medium">Movement patterns</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PATTERNS.map((p) => (
                      <PatternTag key={p} pattern={p} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium">Block intent</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["strength", "conditioning", "skill", "mobility"] as const).map((i) => (
                      <IntentTag key={i} intent={i} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium">Effort (pace and load)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["easy", "moderate", "hard", "max"] as const).map((e) => (
                      <EffortTag key={e} axis="pace" effort={e} />
                    ))}
                    {(["easy", "moderate", "hard"] as const).map((e) => (
                      <EffortTag key={e} axis="load" effort={e} />
                    ))}
                  </div>
                </div>
              </div>
            </ThemePanel>
          ))}
        </div>
      </Section>

      <Section id="space" title="Space and shape" intro="A 4 px grid. Controls are 28–32 px tall, rows 32 px. Corners 6 px; popovers float on a soft shadow, panels sit flat on a hairline border.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            {[4, 8, 12, 16, 24, 32, 48].map((px) => (
              <div key={px} className="flex items-center gap-3">
                <span className="w-10 text-right text-xs text-muted-foreground tabular">{px}</span>
                <span className="h-3 rounded-sm bg-primary" style={{ width: px * 3 }} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid size-24 place-items-center rounded-sm border border-border bg-surface text-xs text-muted-foreground">4 px</div>
            <div className="grid size-24 place-items-center rounded-md border border-border bg-surface text-xs text-muted-foreground">5 px</div>
            <div className="grid size-24 place-items-center rounded-lg border border-border bg-surface text-xs text-muted-foreground">6 px</div>
            <div className="grid size-24 place-items-center rounded-lg bg-surface-raised text-xs text-muted-foreground shadow-raised">Raised</div>
          </div>
        </div>
      </Section>

      <Section id="components" title="Components" intro="shadcn/ui on Base UI, restyled to these tokens. One focus style everywhere: a visible ring for keyboard users.">
        <div className="grid gap-8">
          <div className="grid gap-3">
            <p className="text-xs font-medium">Buttons</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button>Save</Button>
              <Button variant="outline">Save as template</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Remove member</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="d-name">Gym name</Label>
              <Input id="d-name" placeholder="Afrek Functional Fitness" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-slug">Address</Label>
              <Input id="d-slug" defaultValue="afrek" />
              <p className="text-xs text-muted-foreground">workout-builder.app/afrek</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-invalid">Email</Label>
              <Input id="d-invalid" defaultValue="anna@" aria-invalid aria-describedby="d-invalid-error" />
              <p id="d-invalid-error" className="text-xs text-destructive">Enter a full email address.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-disabled">Role</Label>
              <Input id="d-disabled" defaultValue="Owner" disabled />
            </div>
          </div>

          <div className="grid gap-3">
            <p className="text-xs font-medium">Badges, keys, loading</p>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Published</Badge>
              <Badge variant="secondary">Draft</Badge>
              <Badge variant="outline">Template</Badge>
              <Badge variant="destructive">Unmatched</Badge>
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
              <div className="flex items-center gap-2" aria-label="Loading example">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">No spinners: content that is still loading keeps its shape.</p>
          </div>

          <div className="grid gap-3">
            <p className="text-xs font-medium">Dialog, menu, select, tooltip, toast</p>
            <InteractiveDemos />
          </div>
        </div>
      </Section>

      <Section id="numbers" title="Honest numbers" intro="Exact values are plain. Estimates show ~ and their range in a quieter tone; the range disappears when it rounds to one number. Screen readers hear 'about 20 min, likely between 17 and 24'.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Exact", <Estimate key="a" measure={exact(202)} unit="AU" />],
            ["Estimate with range", <Estimate key="b" measure={estimated(20.42, 17.43, 24.41)} unit="min" />],
            ["Rounded to 10 m", <Estimate key="c" measure={estimated(1225.74, 1021.45, 1442.05)} unit="m" />],
            ["Range rounds away", <Estimate key="d" measure={estimated(120.2, 119.9, 120.4)} unit="AU" />],
          ].map(([label, node]) => (
            <div key={label as string} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{node}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="keyboard" title="Keyboard" intro="Every action has a keyboard path. Shortcuts are shown next to the actions they trigger.">
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {KEYS.map(([keys, action, step]) => (
            <div key={action} className="flex items-center gap-4 px-4 py-2.5">
              <KbdGroup className="w-24">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </KbdGroup>
              <span className="flex-1">{action}</span>
              <span className="text-xs text-muted-foreground">from {step}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="density" title="Density" intro="How a block reads in the builder (4b), with numbers from the real engine for calc spec §7 WOD 1 C.">
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="rounded-lg border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="grid size-6 place-items-center rounded-md bg-surface-sunken text-xs font-semibold">C</span>
              <span className="font-medium">AMRAP 8 min</span>
              <IntentTag intent="conditioning" />
              <EffortTag axis="pace" effort="hard" />
              <span className="ml-auto text-xs text-muted-foreground">
                {blockC?.rounds && <Estimate measure={blockC.rounds} unit="rounds" />} rounds
              </span>
            </div>
            <ul className="divide-y divide-border">
              {DENSITY_LINES.map(([qty, name, pattern]) => (
                <li key={name} className="grid h-8 grid-cols-[3rem_1fr_auto] items-center gap-3 px-4">
                  <span className="text-right tabular">{qty}</span>
                  <span>{name}</span>
                  {pattern ? <PatternTag pattern={pattern} /> : <span className="text-xs text-muted-foreground">Jump rope</span>}
                </li>
              ))}
            </ul>
          </div>
          <aside aria-label="Load panel example" className="rounded-lg border border-border bg-surface-sunken p-4">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">Session</p>
            <p className="mt-1 text-2xl font-semibold">{wod1.sRpe && <Estimate measure={wod1.sRpe} unit="AU" />}</p>
            <p className="text-xs text-muted-foreground">planned load · {wod1.durationMin && <Estimate measure={wod1.durationMin} unit="min" />}</p>
            <dl className="mt-4 grid gap-1.5">
              {(["squat", "hinge", "h_push", "h_pull"] as const).map((p) => {
                const m = wod1.exposure.reps[p];
                return (
                  <div key={p} className="flex items-center justify-between gap-2">
                    <dt>
                      <PatternTag pattern={p} />
                    </dt>
                    <dd className="text-sm">{m && <Estimate measure={m} unit="reps" />}</dd>
                  </div>
                );
              })}
            </dl>
          </aside>
        </div>
      </Section>
    </div>
  );
}
