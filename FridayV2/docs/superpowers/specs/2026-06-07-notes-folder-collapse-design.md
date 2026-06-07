# Notes Page: Folders Collapsed by Default — Design

**Date:** 2026-06-07
**Status:** Approved

## Problem

On load, the Notes page auto-expands all top-level folders, making the tree noisy when a vault has many folders.

## Goal

Folders start collapsed. The user explicitly clicks to expand any folder they want to see.

## Scope

Frontend only. One file: `FridayV2/frontend/app/(dashboard)/notes/page.tsx`.

## Design

### Current behaviour

`NotesPage` initialises `openFolders` as an empty `Set`, then in the `useEffect` that fetches the vault tree it immediately overwrites it:

```ts
const topFolders = d.tree.filter((n) => n.type === "folder").map((n) => n.path);
setOpenFolders(new Set(topFolders));
```

This auto-expands every top-level folder on every page load.

### Change

Remove the two lines above. `openFolders` stays as the empty `Set` it was initialised with. The `TreeItem` component already handles the collapsed state correctly — `isOpen` is `false` when the path is not in the set, so children are not rendered.

No other logic changes. Toggle behaviour (click to expand/collapse) is unchanged.

## Out of scope

- Persisting expand state in `localStorage` (not requested)
- Nested folder expand/collapse (already works via the same toggle)
