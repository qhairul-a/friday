# Settings Memory UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six targeted UI improvements to the Memory tab in the Settings page: search, add-form-to-top, folder icons on categories, custom categories via datalist, multi-line textareas, and color coding by source.

**Architecture:** All changes are in a single file (`FridayV2/frontend/app/(dashboard)/settings/page.tsx`). No new components, no new API calls, no schema changes. Tasks are ordered so each produces a working intermediate state.

**Tech Stack:** Next.js 15 / React / TypeScript. No new npm packages.

---

## File Map

| Action | File |
|--------|------|
| Modify | `FridayV2/frontend/app/(dashboard)/settings/page.tsx` |

---

## Task 1: Search + Move Add Form to Top

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/settings/page.tsx`

**Context:** The Memory tab currently renders: description → empty state → category sections → Add form. We add a `search` state, derive `filteredMemory` from it, rewire `byCategory` to use `filteredMemory`, add a search input at the top, and move the Add form above the category sections.

- [ ] **Step 1: Read the file**

Read `FridayV2/frontend/app/(dashboard)/settings/page.tsx` in full to confirm exact line numbers before making any edits.

- [ ] **Step 2: Add `search` state**

Find the state declarations block (around line 25–30). After:
```ts
  const [hidden, setHidden]   = useState<string[]>([]);
```
Add:
```ts
  const [search, setSearch]   = useState("");
```

- [ ] **Step 3: Rewire `byCategory` to filter by search**

Find the existing `byCategory` derived value (around lines 64–68):
```ts
  const byCategory = memory.reduce<Record<string, MemoryRow[]>>((acc, r) => {
    const cat = r.category.charAt(0).toUpperCase() + r.category.slice(1);
    (acc[cat] = acc[cat] || []).push(r);
    return acc;
  }, {});
```

Replace with:
```ts
  const filteredMemory = search.trim()
    ? memory.filter(r => r.fact.toLowerCase().includes(search.toLowerCase()))
    : memory;

  const byCategory = filteredMemory.reduce<Record<string, MemoryRow[]>>((acc, r) => {
    const cat = r.category.charAt(0).toUpperCase() + r.category.slice(1);
    (acc[cat] = acc[cat] || []).push(r);
    return acc;
  }, {});
```

- [ ] **Step 4: Add search input and move Add form to top in the Memory tab JSX**

Inside `{tab === "memory" && ( <div> ... </div> )}`, find the current layout:
```tsx
          <p style={{ color: "var(--text-3)", fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
            What Friday knows about you. Updated automatically after every conversation. Edit or remove facts at any time.
          </p>

          {memory.length === 0 && (
            <div className="glass" style={{ padding: "24px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "var(--text-3)", fontSize: 13 }}>No memory yet — chat with Friday to build her profile of you.</p>
            </div>
          )}

          {Object.entries(byCategory).sort().map(([cat, facts]) => (
```

Replace (up to and including the `{Object.entries...` opening line) with — note the Add form block that was at the bottom is now inserted here, and the search input is first:

```tsx
          <p style={{ color: "var(--text-3)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            What Friday knows about you. Updated automatically after every conversation. Edit or remove facts at any time.
          </p>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memory…"
            style={{ ...inputStyle, width: "100%", marginBottom: 20 }}
            className="cyber-input"
          />

          {/* Add fact — now at top */}
          <div className="glass" style={{ padding: "24px", marginBottom: 28 }}>
            <div className="label-cyan" style={{ marginBottom: 14 }}>+ Add Fact Manually</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={newFact.category}
                onChange={(e) => setNewFact(p => ({ ...p, category: e.target.value }))}
                style={{ ...inputStyle, width: 160 }}
                className="cyber-input"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <input
                value={newFact.fact}
                onChange={(e) => setNewFact(p => ({ ...p, fact: e.target.value }))}
                placeholder="e.g. Prefers morning workouts before 8am"
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                className="cyber-input"
                onKeyDown={(e) => e.key === "Enter" && addFact()}
              />
              <button onClick={addFact} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
            </div>
          </div>

          {filteredMemory.length === 0 && search.trim() && (
            <div className="glass" style={{ padding: "24px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "var(--text-3)", fontSize: 13 }}>No matching memories found.</p>
            </div>
          )}

          {filteredMemory.length === 0 && !search.trim() && (
            <div className="glass" style={{ padding: "24px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "var(--text-3)", fontSize: 13 }}>No memory yet — chat with Friday to build her profile of you.</p>
            </div>
          )}

          {Object.entries(byCategory).sort().map(([cat, facts]) => (
```

- [ ] **Step 5: Remove the old Add form block at the bottom**

At the end of the Memory tab section, find and delete this entire block (it has been moved to the top in Step 4):
```tsx
          {/* Add fact */}
          <div className="glass" style={{ padding: "24px" }}>
            <div className="label-cyan" style={{ marginBottom: 14 }}>+ Add Fact Manually</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={newFact.category}
                onChange={(e) => setNewFact(p => ({ ...p, category: e.target.value }))}
                style={{ ...inputStyle, width: 160 }}
                className="cyber-input"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <input
                value={newFact.fact}
                onChange={(e) => setNewFact(p => ({ ...p, fact: e.target.value }))}
                placeholder="e.g. Prefers morning workouts before 8am"
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                className="cyber-input"
                onKeyDown={(e) => e.key === "Enter" && addFact()}
              />
              <button onClick={addFact} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
            </div>
          </div>
```

- [ ] **Step 6: Verify TypeScript build**

```
cd FridayV2/frontend && npm run build
```

Expected: exits 0 with no type errors.

- [ ] **Step 7: Commit**

```
git add FridayV2/frontend/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): search memory + move add form to top"
```

---

## Task 2: Folder Icons + Color Coding by Source + Source Fix

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/settings/page.tsx`

**Context:** Add `📁` prefix to category headers, add a `sourceColor()` helper, wire it to the accent bar, and fix `addFact()` to insert `source: "manual"` instead of `"stated"`.

- [ ] **Step 1: Read the file**

Read `FridayV2/frontend/app/(dashboard)/settings/page.tsx` to confirm current state after Task 1.

- [ ] **Step 2: Add `sourceColor` helper before `SettingsPage`**

Find the line:
```ts
export default function SettingsPage() {
```

Add immediately before it:
```ts
function sourceColor(source: string): string {
  if (source === "friday") return "var(--violet)";
  if (source === "stated") return "var(--cyan)";
  if (source === "manual") return "var(--orange)";
  return "var(--text-3)";
}

```

- [ ] **Step 3: Add 📁 prefix to category headers**

Find the category header div inside `{Object.entries(byCategory).sort().map(([cat, facts]) => (`:
```tsx
              <div className="label" style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{cat}</div>
```

Replace with:
```tsx
              <div className="label" style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>📁 {cat}</div>
```

- [ ] **Step 4: Wire accent bar to `sourceColor`**

Find the accent bar div inside each memory row:
```tsx
                    <div style={{ width: 2, minHeight: 20, background: "var(--violet)", borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
```

Replace with:
```tsx
                    <div style={{ width: 2, minHeight: 20, background: sourceColor(r.source), borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
```

- [ ] **Step 5: Fix `addFact` insert source**

Find in the `addFact` function:
```ts
    await supabase.from("user_memory").insert({ category: newFact.category, fact: newFact.fact, source: "stated" });
```

Replace with:
```ts
    await supabase.from("user_memory").insert({ category: newFact.category, fact: newFact.fact, source: "manual" });
```

- [ ] **Step 6: Verify TypeScript build**

```
cd FridayV2/frontend && npm run build
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```
git add FridayV2/frontend/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): folder icons, color coding by source, fix manual source"
```

---

## Task 3: Custom Categories (Datalist) + Multi-line Textareas

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/settings/page.tsx`

**Context:** Replace the `<select>` in the Add form with a `<input>` + `<datalist>` so custom categories can be typed. Replace the fact `<input>` in the Add form and in edit mode with `<textarea>` (Ctrl+Enter to submit, plain Enter for newline).

- [ ] **Step 1: Read the file**

Read `FridayV2/frontend/app/(dashboard)/settings/page.tsx` to confirm current state after Task 2.

- [ ] **Step 2: Replace `<select>` with `<input>` + `<datalist>` in the Add form**

In the Add form (now at the top of the Memory tab), find:
```tsx
              <select
                value={newFact.category}
                onChange={(e) => setNewFact(p => ({ ...p, category: e.target.value }))}
                style={{ ...inputStyle, width: 160 }}
                className="cyber-input"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
```

Replace with:
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

- [ ] **Step 3: Replace fact `<input>` with `<textarea>` in the Add form**

In the Add form, find:
```tsx
              <input
                value={newFact.fact}
                onChange={(e) => setNewFact(p => ({ ...p, fact: e.target.value }))}
                placeholder="e.g. Prefers morning workouts before 8am"
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                className="cyber-input"
                onKeyDown={(e) => e.key === "Enter" && addFact()}
              />
```

Replace with:
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

- [ ] **Step 4: Replace fact `<input>` with `<textarea>` in edit mode**

In the edit mode section of each memory row, find:
```tsx
                        <input
                          value={editFact}
                          onChange={(e) => setEditFact(e.target.value)}
                          style={{ ...inputStyle, flex: 1 }}
                          className="cyber-input"
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(r.id)}
                          autoFocus
                        />
```

Replace with:
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

- [ ] **Step 5: Verify TypeScript build**

```
cd FridayV2/frontend && npm run build
```

Expected: exits 0 with no type errors.

- [ ] **Step 6: Manual test**

Open `http://localhost:3000/settings` (log in first).

- Type in the search box — confirm memory entries filter in real-time
- Add form is at the top (above the memory list)
- Click the category field — confirm the 8 presets appear as suggestions; type a custom word and confirm it's accepted
- Confirm fact input is multi-line; press Enter for newline, Ctrl+Enter to add
- Confirm category headers show `📁` prefix
- Confirm accent bars are colored: violet for friday-added entries, cyan for stated, orange for manual
- Add a new fact via the form — confirm it gets `source: "manual"` (accent bar should be orange)

- [ ] **Step 7: Commit**

```
git add FridayV2/frontend/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): custom categories via datalist, multi-line textareas"
```
