# Design system

**Status:** v1.2, Step 4b (2026-10-21): the builder, calendar, exercises and paces built on it. Shown live on `/design` (local and preview deployments only).
**Source of truth:** tokens in `src/app/globals.css`; components in `src/components/ui` (shadcn/ui on Base UI, restyled) and `src/components/design`. Contrast is checked by `src/lib/design/tokens.test.ts` on every push.

Earlier prototypes are not a reference for anything here (CLAUDE.md). Every decision below comes from how coaches program.

## 1. Principles

1. **Keyboard-first.** A coach can program a full week without the mouse. ⌘K (Ctrl K) reaches every page and action; frequent actions have single-key shortcuts; every control is reachable with Tab and shows a visible focus ring.
2. **Instant.** Optimistic updates; no spinners in the builder; the engine runs on the coach's device. Loading content keeps its shape (skeletons), never a spinner in the middle of work.
3. **Dense but calm.** A professional tool (quality bar: Linear, Notion, Figma), not a consumer fitness app. Small readable type, a lot on one screen, quiet surfaces, colour only where it carries meaning.
4. **Honest numbers.** Exact values are plain. Estimates always show `~` and their range. Every warning links to the line that causes it. No invented precision.
5. **One system.** Every colour, size, space and radius comes from the tokens below, in light and dark. No one-off values in screens.

## 2. Typography

Font: **Geist** (sans) for everything; numbers use tabular figures (`.tabular`, and automatically in tables and `<output>`). Geist Mono only for codes and IDs.

| Token | Size / line | Use |
|---|---|---|
| `text-3xl` | 32 / 40 | Rare: empty states |
| `text-2xl` | 24 / 32 | Key numbers (load panel) |
| `text-xl` | 20 / 28 | Page titles |
| `text-lg` | 16 / 24 | Section and dialog titles |
| `text-base` | 14 / 22 | Reading text, descriptions |
| `text-sm` | 13 / 20 | **Default for the interface** |
| `text-xs` | 12 / 16 | Secondary text, table details |
| `text-2xs` | 11 / 16 | Keys, small uppercase labels |

Weights: 400 for text, 500 for labels and buttons, 600 for titles and key numbers. Nothing heavier. Larger sizes get slightly tighter letter-spacing (built into the tokens).

## 3. Colour

OKLCH tokens, light on `:root`/`.light`, dark on `.dark` (a subtree can force either). A cool neutral base with a faint blue tint, one action colour (indigo), status colours, and semantic colours.

| Group | Tokens | Rule |
|---|---|---|
| Surfaces | `background` (app canvas), `surface` (panels, inputs), `surface-sunken` (sidebar, wells), `surface-raised` (menus, dialogs), `hover` | Panels sit flat on a hairline border; only floating layers get a shadow |
| Text | `foreground`, `muted-foreground`, `subtle-foreground`, `primary-text` | Body ≥ 7:1, secondary ≥ 4.5:1, subtle (placeholders, disabled) ≥ 3:1 |
| Lines | `border`, `border-strong`, `input`, `ring` | Form-field borders and the focus ring ≥ 3:1 (WCAG non-text contrast) |
| Action | `primary`, `primary-foreground`, `primary-subtle` | Primary colour only on the one main action of a view, selection and links |
| Status | `destructive`, `warning`, `success` + `-subtle` backgrounds | Status text ≥ 4.5:1 on surfaces |

shadcn's role names (`card`, `popover`, `muted`, `accent`, `secondary`, `sidebar`…) are mapped onto these tokens in `globals.css`, so library components follow the system.

### Semantic colour
Colour that means something, always next to a label (never colour alone), each ≥ 3:1 against the surface in both themes.

- **Movement patterns** (11): lower body warm (squat orange, lunge amber, hinge coral, jump lime), upper body cool (horizontal push blue, vertical push sky, horizontal pull teal, vertical pull green), core violet (core violet, rotation magenta), carry stone. Tokens `--pattern-<key>` (underscores become dashes).
- **Block intent** (4): strength indigo, conditioning orange, skill cyan, mobility green. `--intent-<key>`.
- **Effort** (4, sequential): easy green → moderate amber → hard orange → max red. `--effort-<key>`.

Components: `PatternTag`, `IntentTag`, `EffortTag` (`src/components/design/tags.tsx`): a dot in the full colour on a 14% tint, with the label in body text.

## 4. Space and shape

- **4 px grid** (Tailwind spacing). Common steps: 4, 8, 12, 16, 24, 32, 48.
- **Heights:** controls 28 px (`sm`) and 32 px (default); table and list rows 32 px; sidebar items 28 px.
- **Radius:** 6 px (`--radius`), 4 px for small parts (keys, tags), full only for dots and avatars.
- **Elevation:** panels flat with a 1 px border; menus, popovers and dialogs float on `shadow-raised`.
- **Motion:** 100 ms, `ease-snappy`, only on colour and opacity; nothing moves for decoration. Respects "reduce motion".

## 5. Components

shadcn/ui components live in `src/components/ui` and are ours to change. Restyled: Button (variants default / outline / secondary / ghost / destructive / link; sizes xs 24, sm 28, default 32, lg 36) and ButtonLink (a real link that looks like a button), Input, Select and InputGroup (32 px, 3:1 border, coloured focus border with a soft ring), Kbd, Badge (square), Skeleton, Table (32 px header in small muted text, 40 px rows, hairline separators), Dialog, Sheet, menus and popovers (hairline border + `shadow-raised`), and the command palette (a plain search row, 32 px results with their shortcuts).

App building blocks (`src/components/app`, `src/components/forms.tsx`):
- **PageHeader / PageBody**: title (`text-xl`), one line of context, at most one primary action; content column up to 1024 px.
- **SettingsSection**: `text-lg` heading, one line of context, optional action on the right; a labelled region for screen readers.
- **TextField / FormError / FormSuccess / SubmitButton**: label, field, help text and error wired together (`aria-describedby`, `aria-invalid`); form-level messages are announced; the submit button says what it is doing ("Saving…").
- **Empty states**: dashed border, what will be here, and the action to start ("Create a track").
- **Builder parts** (`src/app/[gym]/builder`): block cards (letter tinted by intent, only the format's own fields, effort in words with the default shown as an outline dot), line rows (exercise · amount · load · what the app understood, e.g. "8–10 reps · 2 × 22.5 kg"), and the load panel (session length and planned load first, then each block, then lenses in tabs; warnings in a quiet warning tone with the line letters as links).
- **Fields that read coach shorthand**: amounts (8-10, 21-15-9, 8/8, 400 m, 15 cal, 0:30, max cal), loads (75-80%, 22.5/15, 2x22.5, bw), durations (3 = 3 min for AMRAP and EMOM, 90 = 90 s for rest). What the app understood is always shown next to the field.

Rules:
- One **primary** button per view; everything else outline, secondary or ghost.
- **Focus:** a 2 px ring in `--ring`, offset 2 px, on every focusable element; inputs show it as a coloured border plus a soft ring.
- **Loading:** skeletons that keep the layout; toasts (bottom right) confirm background saves; no blocking spinners.
- **Empty states** say what will be here and the shortcut to start.
- **Destructive actions** use the destructive variant and confirm with what will happen in words ("Cara Coach loses access to Afrek right away. Their past work stays.").
- **Forms** check on submit and keep what was typed; each problem is shown under its field, in words a coach would use.
- **Changes in lists** (roles, removals, archive) update instantly and are confirmed with a toast; if the server refuses, the list goes back and the toast says why.
- **Read-only** views (a coach on Members, a viewer on Tracks) show the same information without controls, plus one line saying who can change it.

## 6. Honest numbers

`formatMeasure` (`src/lib/format.ts`) and the `Estimate` component are the only way computed values are shown.

- Exact: plain (`202 AU`, `15 min`).
- Estimate: `~` + middle value, then the range in a quieter, smaller tone (`~20 min 17–24`); the range is hidden when it rounds to a single number, the `~` stays.
- Precision by unit: minutes 1 decimal under 10, else whole; AU, reps, calories whole; AMRAP rounds 1 decimal; fractional hard sets 1 decimal; **estimated metres round to 10 m**; kilograms keep halves (22.5 kg) below 100, whole above (volume load); thousands separators.
- Screen readers hear "about 20 min, likely between 17 and 24" (visually hidden text; the visible digits are hidden from them).
- Every warning names its line ("A2") and jumps to it.
- Sums of estimates stay estimates (the calendar's week total keeps its "~").

## 7. Keyboard

| Keys | Action | Where |
|---|---|---|
| ⌘ K | Command palette: every page and action; the builder adds Save, Publish, Add block, Template | Anywhere |
| G then B / C / A / E / S | Builder / Calendar / Analytics / Exercises / Settings | Anywhere |
| G then P | Your profile | Anywhere |
| ? | All shortcuts | Anywhere |
| ⌘ S | Save the workout | Builder |
| Enter | New line below (in an exercise, amount or load field) | Builder |
| ⌘ Enter | New block below | Builder |
| ⌥ ↑ / ↓ | Move the line | Builder |
| ⌘ ⌫ | Delete the line | Builder |
| ↑ ↓ then Enter | Pick an exercise; a generic word ("squat") waits for a pick, never guesses | Exercise field |

Shortcuts appear next to the actions they trigger (menus, tooltips, palette).

## 8. Accessibility

WCAG 2.2 AA as the floor: contrast as above (tested), full keyboard use, visible focus, labels on every control, `aria-live` for background saves and warnings, no information by colour alone, respects reduced motion. Playwright runs an axe scan on every screen in light and dark.

## 9. Layout

App shell: sidebar (240 px) with gym switcher, "Go to or do… ⌘K", navigation (shortcut keys appear on hover and focus) and user menu; content area with a page header (title, one primary action). Below 1024 px the sidebar becomes a sheet opened from a slim top bar. The frame renders instantly; the sidebar and each page show skeletons of their own shape while data arrives. Settings pages share a tab row (Gym · Members · Tracks · Profile). The builder (4b) is two panes: workout on the left, live load panel on the right. Desktop and tablet for programming; phones for viewing and logging results.
