# Notes Folder Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all folders in the Notes page start collapsed; user expands them manually.

**Architecture:** Remove two lines from the vault-tree `useEffect` in `NotesPage`. No new state, no new logic — the toggle mechanism already handles collapsed state correctly when the `openFolders` Set is empty.

**Tech Stack:** TypeScript, React, Next.js

---

### Task 1: Remove auto-expand on load

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/notes/page.tsx`

- [ ] **Step 1: Open the file and locate the vault-tree useEffect**

Find this block (around line 146):

```ts
useEffect(() => {
  apiFetch<VaultTree>("/notes/tree")
    .then((d) => {
      setData(d);
      // Auto-expand top-level folders
      const topFolders = d.tree.filter((n) => n.type === "folder").map((n) => n.path);
      setOpenFolders(new Set(topFolders));
    })
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

- [ ] **Step 2: Remove the two auto-expand lines**

Replace the block above with:

```ts
useEffect(() => {
  apiFetch<VaultTree>("/notes/tree")
    .then((d) => {
      setData(d);
    })
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

The `openFolders` state initialises as `new Set()` at line 144 — no other change needed.

- [ ] **Step 3: Run the TypeScript build**

```bash
cd FridayV2/frontend
npm run build
```

Expected: build succeeds with 0 errors.

- [ ] **Step 4: Visual check**

```bash
npm run dev
```

Open `http://localhost:3000/notes`. All folders should appear collapsed (▶ chevron, no children visible). Click a folder — it expands. Click again — it collapses.

- [ ] **Step 5: Commit**

```bash
cd FridayV2/frontend
git add app/\(dashboard\)/notes/page.tsx
git commit -m "feat(notes): folders collapsed by default on load

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
