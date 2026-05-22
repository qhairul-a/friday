import json
import os
import anthropic


ROUTE_PROMPT = """You are an intent router for a personal AI assistant named Friday.

Given the user's message, determine what kind of information it contains and what action Friday should take.

Respond with a JSON object only — no explanation, no markdown:
{
  "intent": one of ["expense", "project_update", "health_update", "goal_update", "note", "note_obsidian", "notes_query", "question", "finance_question", "task_add", "task_update", "incomplete"],
  "data": { extracted structured data relevant to the intent },
  "needs_followup": true/false,
  "followup_question": "question to ask user if needs_followup is true, else null",
  "summary": "one-line summary of what was captured"
}

Intent definitions:
- expense: user is logging a financial expense (extract: amount, category, description, date if given)
- project_update: user mentions a work project, task, or professional update
- health_update: user mentions diet, fitness, health habits
- goal_update: user sets or updates a personal or professional goal
- note: general idea, thought, or information that doesn't fit other categories
- note_obsidian: user explicitly wants to save a note to their notes system (keywords: "note that", "jot this down", "save this as a note", "add to my notes", "note to self", "write this down") — extract: title (short 3-6 word summary), content (full note text)
- notes_query: user wants to search or retrieve information from their notes (keywords: "check my notes", "search my notes", "what did I note about", "do I have any notes on", "look in my notes", "find notes about") — extract: query (the search keywords as a short phrase)
- finance_question: user is asking about their finances, spending, budget, or expenses (e.g. "how much did I spend?", "what's my budget looking like?", "give me a financial summary", "how are my finances?", "am I on track?")
- task_add: user wants to add a new task or to-do item (e.g. "add task", "remind me to", "I need to do", "create a task") — extract: title (required), priority ("low"/"normal"/"high", default "normal"), due_date (ISO date if mentioned, else null)
- task_update: user wants to update the status of an existing task (e.g. "mark X as done", "X is in progress", "I finished X", "move X to done") — extract: title_fragment (key words to match the task), new_status ("todo"/"in_progress"/"done")
- question: user is asking Friday something general (not finance-related, not capturing information)
- incomplete: the message suggests something needs to be logged but lacks key details

Currency note: The user is based in Singapore. SGD, S$, and $ all refer to Singapore Dollars. Always extract the numeric amount only (e.g. S$15 → amount: 15).

Keywords that signal an expense: "expense log", "spent", "paid", "bought", "purchased", "SGD", "S$", "$", "cost me".

For expenses: ALWAYS set needs_followup to false as long as an amount is present. Log immediately — do not ask for category. Infer category from description if obvious, otherwise use "general". Only set needs_followup to true if there is NO numeric amount in the message at all.

For date: return null if the user says "today" or does not mention a specific date. Only return an ISO date string (YYYY-MM-DD) if the user mentions a specific past date (e.g. "yesterday", "last Monday", "on the 15th") — resolve it to an actual date. Never return relative words like "today" or "yesterday" as the date value.

Examples:
"Expense log, spent $15 at waterview minimart" → intent: expense, needs_followup: false, data: {amount: 15, category: "general", description: "waterview minimart"}
"Expense log, spent RM15 at the grocery store" → intent: expense, needs_followup: false, data: {amount: 15, category: "food", description: "grocery store"}
"Spent $7 at the grocery store" → intent: expense, needs_followup: false, data: {amount: 7, category: "food", description: "grocery store"}
"Paid $50 for petrol" → intent: expense, needs_followup: false, data: {amount: 50, category: "transport", description: "petrol"}
"Expense log at waterview minimart" → intent: incomplete, needs_followup: true, followup_question: "How much did you spend at waterview minimart?"
"I need to start working on a new project" → intent: project_update, needs_followup: true
"My goal this month is to save $500" → intent: goal_update, data: {type: "short_term", text: "Save $500 this month"}
"How are my finances this month?" → intent: question
"""


def route(message: str) -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=ROUTE_PROMPT,
        messages=[{"role": "user", "content": message}],
    )
    raw = response.content[0].text.strip()

    # Strip markdown code blocks if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    raw = raw.strip()

    print(f"[router] raw response: {raw}")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[router] JSON parse error: {e}")
        return {
            "intent": "note",
            "data": {},
            "needs_followup": False,
            "followup_question": None,
            "summary": message[:100],
        }
