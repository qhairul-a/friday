import os
from datetime import date
from profile.storage import update_section, append_note, log_capture, load_profile
from profile.schema import FridayProfile
from brain.router import route
from integrations.sheets import append_expense, extract_sheet_id
from integrations.tasks import add_task, update_task_status
from integrations.gdrive_notes import write_note


def handle_capture(user_id: str, raw_text: str) -> dict:
    result = route(raw_text)
    intent = result.get("intent", "note")
    data = result.get("data", {})
    needs_followup = result.get("needs_followup", False)
    followup_question = result.get("followup_question")
    summary = result.get("summary", raw_text[:80])

    routed_to = intent

    if intent == "incomplete":
        needs_followup = True
        followup_question = followup_question or "Could you give me more details? For an expense, include the amount and where you spent it."
        routed_to = "pending"

    elif intent == "expense" and needs_followup:
        routed_to = "finance (pending details)"

    elif intent == "expense":
        profile = load_profile(user_id)
        sheet_id = extract_sheet_id(profile.finance.google_sheet_id)
        if sheet_id:
            append_expense(
                sheet_id=sheet_id,
                amount=data.get("amount", 0),
                category=data.get("category", "self"),
                description=data.get("description", ""),
                expense_date=data.get("date"),
            )
            routed_to = "finance (Google Sheet)"
        else:
            routed_to = "finance (no sheet configured)"

    elif intent == "project_update" and not needs_followup:
        profile = load_profile(user_id)
        projects = profile.work_and_projects.active_projects
        projects.append({
            "name": data.get("name", "Unnamed project"),
            "status": data.get("status", "planning"),
            "deadline": data.get("deadline", ""),
            "notes": data.get("notes", raw_text),
        })
        update_section(user_id, "work_and_projects", {"active_projects": projects})
        routed_to = "work_and_projects"

    elif intent == "health_update":
        profile = load_profile(user_id)
        existing_notes = profile.health.notes
        updated = f"{existing_notes}\n{raw_text}".strip() if existing_notes else raw_text
        update_section(user_id, "health", {"notes": updated})
        routed_to = "health"

    elif intent == "goal_update":
        profile = load_profile(user_id)
        goal_type = data.get("type", "short_term")
        goal_text = data.get("text", raw_text)
        goals = profile.goals
        if goal_type == "long_term":
            goals.long_term.append(goal_text)
            update_section(user_id, "goals", {"long_term": goals.long_term})
        else:
            goals.short_term.append(goal_text)
            update_section(user_id, "goals", {"short_term": goals.short_term})
        routed_to = "goals"

    elif intent == "task_add":
        title = data.get("title", raw_text[:80])
        task = add_task(
            user_id=user_id,
            title=title,
            priority=data.get("priority", "normal"),
            due_date=data.get("due_date"),
            notes=data.get("notes", ""),
        )
        routed_to = "tasks"
        summary = f"Task added: {title}"

    elif intent == "task_update":
        title_fragment = data.get("title_fragment", "")
        new_status = data.get("new_status", "done")
        matched = update_task_status(user_id, title_fragment, new_status)
        if matched:
            routed_to = "tasks"
            summary = f"Task '{matched['title']}' marked as {new_status}"
        else:
            needs_followup = True
            followup_question = f"I couldn't find a task matching '{title_fragment}'. Can you be more specific?"
            routed_to = "tasks (not found)"

    elif intent == "note_obsidian":
        title = data.get("title", raw_text[:40])
        content = data.get("content", raw_text)
        write_note(title, content)
        routed_to = "obsidian"
        summary = f"Note saved: {title}"

    else:
        append_note(user_id, raw_text)
        routed_to = "notes"

    status = "pending_followup" if needs_followup else "logged"
    log_capture(user_id, raw_text, routed_to, status)

    return {
        "intent": intent,
        "routed_to": routed_to,
        "summary": summary,
        "needs_followup": needs_followup,
        "followup_question": followup_question,
        "status": status,
    }
