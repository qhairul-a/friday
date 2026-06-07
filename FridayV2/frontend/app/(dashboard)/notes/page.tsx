"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface FileNode {
  type: "file";
  name: string;
  path: string;
  modifiedTime: string;
}

interface FolderNode {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

type TreeNode = FileNode | FolderNode;

interface VaultTree {
  tree: TreeNode[];
  vaultName: string;
}

function flattenFiles(nodes: TreeNode[]): FileNode[] {
  const files: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      files.push(node);
    } else {
      files.push(...flattenFiles(node.children));
    }
  }
  return files;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

function TreeItem({
  node,
  depth,
  vaultName,
  openFolders,
  toggleFolder,
}: {
  node: TreeNode;
  depth: number;
  vaultName: string;
  openFolders: Set<string>;
  toggleFolder: (path: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const indent = depth * 16;

  if (node.type === "folder") {
    const isOpen = openFolders.has(node.path);
    return (
      <>
        <div
          onClick={() => toggleFolder(node.path)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            paddingLeft: 12 + indent,
            cursor: "pointer",
            borderRadius: 6,
            background: hovered ? "rgba(34,211,238,0.05)" : "transparent",
            color: "var(--text-2)",
            fontFamily: "var(--font-space)",
            fontSize: 13,
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: 10, color: "var(--text-3)", width: 12, textAlign: "center", flexShrink: 0 }}>
            {isOpen ? "▼" : "▶"}
          </span>
          <span style={{ fontSize: 14, opacity: 0.7, flexShrink: 0 }}>◫</span>
          <span style={{ fontWeight: 500 }}>{node.name}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>
            {node.children.length}
          </span>
        </div>
        {isOpen && node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            vaultName={vaultName}
            openFolders={openFolders}
            toggleFolder={toggleFolder}
          />
        ))}
      </>
    );
  }

  const obsidianUrl = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(node.path)}`;

  return (
    <a
      href={obsidianUrl}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        paddingLeft: 12 + indent + 20,
        borderRadius: 6,
        background: hovered ? "rgba(34,211,238,0.06)" : "transparent",
        color: hovered ? "var(--cyan)" : "var(--text-2)",
        fontFamily: "var(--font-space)",
        fontSize: 13,
        textDecoration: "none",
        cursor: "pointer",
        transition: "color 0.15s, background 0.15s",
      }}
    >
      <span style={{ fontSize: 13, opacity: 0.5, flexShrink: 0 }}>◻</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
        {formatDate(node.modifiedTime)}
      </span>
    </a>
  );
}

export default function NotesPage() {
  const [data, setData]       = useState<VaultTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<VaultTree>("/notes/tree")
      .then((d) => {
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleFolder = useCallback((path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const searchResults = search.trim()
    ? (data ? flattenFiles(data.tree).filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.path.toLowerCase().includes(search.toLowerCase())
      ) : [])
    : null;

  return (
    <div style={{ padding: "40px 48px", height: "100%", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{
            fontFamily: "var(--font-space)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-1)",
            letterSpacing: "0.02em",
          }}>
            Notes
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 4,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            {data ? `${flattenFiles(data.tree).length} notes · ${data.vaultName}` : "Loading vault…"}
          </div>
        </div>
        <input
          type="text"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            color: "var(--text-1)",
            fontFamily: "var(--font-space)",
            fontSize: 13,
            width: 220,
            outline: "none",
          }}
        />
      </div>

      {/* Tree widget */}
      <div style={{
        flex: 1,
        background: "var(--bg-1)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}>

        {/* Column headers */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          flexShrink: 0,
        }}>
          <span style={{ flex: 1 }}>Name</span>
          <span>Modified</span>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loading && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 120,
              color: "var(--text-3)",
              fontFamily: "var(--font-space)",
              fontSize: 13,
            }}>
              Loading vault…
            </div>
          )}

          {error && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 120,
              color: "#f87171",
              fontFamily: "var(--font-space)",
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Search results (flat list) */}
          {!loading && !error && searchResults && (
            searchResults.length === 0 ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 80,
                color: "var(--text-3)",
                fontFamily: "var(--font-space)",
                fontSize: 13,
              }}>
                No notes match &ldquo;{search}&rdquo;
              </div>
            ) : searchResults.map((file) => (
              <TreeItem
                key={file.path}
                node={file}
                depth={0}
                vaultName={data!.vaultName}
                openFolders={openFolders}
                toggleFolder={toggleFolder}
              />
            ))
          )}

          {/* Full tree */}
          {!loading && !error && !searchResults && data && data.tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              vaultName={data.vaultName}
              openFolders={openFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
