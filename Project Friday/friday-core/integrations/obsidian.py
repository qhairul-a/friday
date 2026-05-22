import os
import re
from datetime import date, datetime


def _vault_path() -> str:
    return os.environ.get("OBSIDIAN_VAULT_PATH", r"G:\My Drive\Q _obsidian")


def _friday_folder() -> str:
    folder = os.path.join(_vault_path(), "Friday")
    os.makedirs(folder, exist_ok=True)
    return folder


def _safe_filename(text: str) -> str:
    return re.sub(r'[<>:"/\\|?*\n\r]', "", text).strip()[:50]


def write_note(title: str, content: str) -> str:
    now = datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d %H%M")
    display_ts = now.strftime("%Y-%m-%d %H:%M")
    safe_title = _safe_filename(title)
    filename = f"{timestamp_str} {safe_title}.md"
    filepath = os.path.join(_friday_folder(), filename)

    body = f"# {title}\n\n{content}\n\n---\n*Captured by Friday · {display_ts}*\n"
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(body)

    return filepath


def get_today_notes(max_notes: int = 15) -> list[dict]:
    vault = _vault_path()
    today = date.today()
    notes = []

    skip_dirs = {".obsidian", ".trash", ".git"}

    for root, dirs, files in os.walk(vault):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
        for fname in files:
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(root, fname)
            try:
                mtime = os.path.getmtime(fpath)
                if date.fromtimestamp(mtime) != today:
                    continue
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    raw = f.read()
                # Strip frontmatter
                if raw.startswith("---"):
                    end = raw.find("---", 3)
                    raw = raw[end + 3:].strip() if end != -1 else raw
                # Strip markdown heading and get snippet
                lines = [l for l in raw.splitlines() if l.strip() and not l.startswith("#")]
                snippet = " ".join(lines[:3])[:150]
                title = fname.removesuffix(".md")
                # Remove timestamp prefix if present (YYYY-MM-DD HHMM )
                title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", title)
                notes.append({
                    "title": title,
                    "path": fpath,
                    "snippet": snippet,
                    "modified": mtime,
                    "modified_str": datetime.fromtimestamp(mtime).strftime("%H:%M"),
                    "is_friday": root.endswith("Friday"),
                })
            except (OSError, PermissionError):
                continue

    return sorted(notes, key=lambda n: n["modified"], reverse=True)[:max_notes]


def _find_snippet(content: str, keywords: list[str], context: int = 150) -> str:
    content_lower = content.lower()
    for kw in keywords:
        idx = content_lower.find(kw)
        if idx >= 0:
            start = max(0, idx - context)
            end = min(len(content), idx + context)
            snippet = content[start:end].strip()
            if start > 0:
                snippet = "…" + snippet
            if end < len(content):
                snippet += "…"
            return snippet
    return content[:300] + ("…" if len(content) > 300 else "")


def search_notes(query: str, max_results: int = 5) -> str:
    keywords = [kw.lower() for kw in query.split() if len(kw) > 2]
    if not keywords:
        return "Please provide a search term."

    vault = _vault_path()
    skip_dirs = {".obsidian", ".trash", ".git"}
    matches = []

    for root, dirs, files in os.walk(vault):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
        for fname in files:
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                fname_lower = fname.lower()
                content_lower = content.lower()
                if any(kw in fname_lower or kw in content_lower for kw in keywords):
                    title = fname.removesuffix(".md")
                    title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", title)
                    snippet = _find_snippet(content, keywords)
                    matches.append({"title": title, "snippet": snippet})
                    if len(matches) >= max_results:
                        break
            except (OSError, PermissionError):
                continue
        if len(matches) >= max_results:
            break

    if not matches:
        return f"No notes found matching '{query}'."

    lines = [f"Found {len(matches)} note(s) for '{query}':\n"]
    for m in matches:
        lines.append(f"— {m['title']}\n  {m['snippet']}\n")
    return "\n".join(lines).strip()


def get_notes_context(max_notes: int = 10) -> str:
    friday_folder = _friday_folder()
    notes = []

    try:
        files = [f for f in os.listdir(friday_folder) if f.endswith(".md")]
        files.sort(reverse=True)
        for fname in files[:max_notes]:
            fpath = os.path.join(friday_folder, fname)
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", fname.removesuffix(".md"))
            notes.append(f"### {title}\n{content[:500]}")
    except (OSError, PermissionError):
        return "No notes available."

    return "\n\n".join(notes) if notes else "No notes saved yet."
