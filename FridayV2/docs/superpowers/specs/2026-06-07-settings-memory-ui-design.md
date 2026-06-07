# Settings Page — Memory Tab UI Improvements Design Spec

## Overview

Six targeted UI improvements to the Memory tab in `FridayV2/frontend/app/(dashboard)/settings/page.tsx`. All changes are frontend-only — no backend schema changes, no new API endpoints.

---

## 1. Search

**What:** A full-width search input at the very top of the Memory tab, above the Add form and memory list.

**State:**
```ts
const [search, setSearch] = useState("");
```

**Derived filtered list:**
```ts
const filteredMemory = search.trim()
  ? memory.filter(r => r.fact.toLowerCase().includes(search.toLowerCase()))
  : memory;
```

**Grouping:** `byCategory` is derived from `filteredMemory` (not `memory` directly). Empty categories are hidden when search is active.

**UI:** `<input>` with placeholder `"Search memory…"`, full width, `inputStyle` + `cyber-input` class. Placed above the Add form.

**Behaviour:** Real-time client-side filter. No API calls. When search is empty, everything shows as before.

---

## 2. Add Form Moves to Top

**What:** The "Add Fact Manually" glass block moves from below the memory list to directly below the search bar (above the category sections).

**No structural changes** to the Add form itself in this section — just repositioning in JSX.

---

## 3. Folder Icons on Category Headers

**What:** Each category section header gets a `📁` prefix.

**Before:** `Preferences`
**After:** `📁 Preferences`

Applied in the `Object.entries(byCategory)` render loop — single character addition to the label string.

---

## 4. Custom Categories via Datalist

**What:** Replace the fixed `<select>` for category choice in the Add form with a text `<input>` backed by a `<datalist>`. The 8 preset categories appear as autocomplete suggestions; any free-form text is also accepted.

**Implementation:**
```tsx
<input
  list="memory-categories"
  value={newFact.category}
  onChange={e => setNewFact(p => ({ ...p, category: e.target.value }))}
  style={{ ...inputStyle, width: 160 }}
  className="cyber-input"
  placeholder="Category"
/>
<datalist id="memory-categories">
  {CATEGORIES.map(c => <option key={c} value={c} />)}
</datalist>
```

**No new state** — `newFact.category` is already a string. Removing the `<select>` removes the constraint to preset values.

---

## 5. Multi-line Textarea for Fact Input

**What:** Replace the single-line `<input>` for fact text (both in the Add form and in edit mode on existing rows) with a `<textarea>`.

**Submission:** `Ctrl+Enter` submits; plain `Enter` inserts a newline.

**Sizing:** `rows={3}`, `resize: "none"`, `maxHeight: 140`, `overflowY: "auto"`. Same `inputStyle` applied.

**Add form textarea:**
```tsx
<textarea
  value={newFact.fact}
  onChange={e => setNewFact(p => ({ ...p, fact: e.target.value }))}
  placeholder="e.g. Prefers morning workouts before 8am"
  rows={3}
  style={{ ...inputStyle, flex: 1, minWidth: 200, resize: "none", maxHeight: 140, overflowY: "auto" }}
  className="cyber-input"
  onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) addFact(); }}
/>
```

**Edit mode textarea (replaces the existing `<input>` in the row):**
```tsx
<textarea
  value={editFact}
  onChange={e => setEditFact(e.target.value)}
  rows={3}
  style={{ ...inputStyle, flex: 1, resize: "none", maxHeight: 140, overflowY: "auto" }}
  className="cyber-input"
  onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) saveEdit(r.id); }}
  autoFocus
/>
```

**Note:** Remove `onKeyDown={e => e.key === "Enter" && saveEdit(r.id)}` from the old `<input>` — Enter no longer submits; only `Ctrl+Enter` does.

---

## 6. Color Coding by Source

**What:** The left accent bar on each memory row changes color based on the `source` field.

**Color map:**
```ts
function sourceColor(source: string): string {
  if (source === "friday")  return "var(--violet)";
  if (source === "stated")  return "var(--cyan)";
  if (source === "manual")  return "var(--orange)";
  return "var(--text-3)";
}
```

**Applied to the accent bar:**
```tsx
<div style={{ width: 2, minHeight: 20, background: sourceColor(r.source), borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
```

The `source` label (already rendered in small monospace on the right) stays unchanged — color provides a second visual cue.

| Source | Color | Meaning |
|--------|-------|---------|
| `"friday"` | violet | Friday added during chat |
| `"stated"` | cyan | User stated in conversation |
| `"manual"` | orange | User added via Settings form |
| other | text-3 (grey) | Unknown/legacy |

---

## Architecture Summary

| Change | Approach | State delta |
|--------|----------|-------------|
| Search | Client-side filter on `memory` | +1 state (`search`) |
| Add form to top | JSX reorder | none |
| Folder icons | String prefix in render | none |
| Custom categories | `<select>` → `<input>` + `<datalist>` | none |
| Multi-line textarea | `<input>` → `<textarea>` in 2 places | none |
| Color coding | `sourceColor()` helper + accent bar | none |

**Source fix:** The current `addFact()` inserts with `source: "stated"`. With color coding, manually-added facts should use `source: "manual"` (orange) to distinguish them from conversation-stated facts (cyan). Update the insert call: `source: "manual"`.

**File changed:** `FridayV2/frontend/app/(dashboard)/settings/page.tsx` only.
No new npm packages. No API changes. No Supabase schema changes.
