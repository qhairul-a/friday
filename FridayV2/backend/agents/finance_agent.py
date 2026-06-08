import anthropic

from core.config import settings
from integrations.finance import (
    list_fixed_expenses,
    add_fixed_expense,
    edit_fixed_expense,
    delete_fixed_expense,
    list_variable_expenses,
    add_variable_expense,
    edit_variable_expense,
    delete_variable_expense,
    get_financial_summary,
)

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "list_fixed_expenses",
        "description": "List all fixed monthly expenses with total.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_fixed_expense",
        "description": "Add a new fixed monthly expense.",
        "input_schema": {
            "type": "object",
            "properties": {
                "item": {"type": "string", "description": "Expense name, e.g. 'Netflix'."},
                "cost": {"type": "number", "description": "Monthly cost amount."},
                "comments": {"type": "string", "description": "Optional notes."},
            },
            "required": ["item", "cost"],
        },
    },
    {
        "name": "edit_fixed_expense",
        "description": "Edit a fixed expense by partial name match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial expense name to find."},
                "cost": {"type": "number", "description": "New cost (optional)."},
                "comments": {"type": "string", "description": "New comments (optional)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "delete_fixed_expense",
        "description": "Delete a fixed expense by partial name match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial expense name."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_variable_expenses",
        "description": "List variable expenses for a month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "Month in YYYY-MM format. Defaults to current month."},
            },
        },
    },
    {
        "name": "add_variable_expense",
        "description": "Add a new variable expense entry.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Date in YYYY-MM-DD format."},
                "category": {"type": "string", "description": "Category, e.g. 'food', 'transport'."},
                "description": {"type": "string", "description": "Description of the expense."},
                "amount": {"type": "number", "description": "Amount spent."},
            },
            "required": ["date", "category", "description", "amount"],
        },
    },
    {
        "name": "edit_variable_expense",
        "description": "Edit a variable expense by partial description match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial description to find."},
                "date": {"type": "string", "description": "New date YYYY-MM-DD (optional)."},
                "category": {"type": "string", "description": "New category (optional)."},
                "description": {"type": "string", "description": "New description (optional)."},
                "amount": {"type": "number", "description": "New amount (optional)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "delete_variable_expense",
        "description": "Delete a variable expense by partial description match. Provide date to narrow down when multiple entries share the same description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial description to match."},
                "date": {"type": "string", "description": "Date in YYYY-MM-DD to narrow the match (optional but recommended when description is common)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_financial_summary",
        "description": "Get a comprehensive financial summary with all analytics: category breakdown, percentages, fixed vs variable, monthly trends, spending frequency, and averages.",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "Month in YYYY-MM format. Defaults to current month."},
            },
        },
    },
]

_TOOL_FNS = {
    "list_fixed_expenses": lambda a: list_fixed_expenses(),
    "add_fixed_expense": lambda a: add_fixed_expense(a["item"], a["cost"], a.get("comments", "")),
    "edit_fixed_expense": lambda a: edit_fixed_expense(a["query"], a.get("cost"), a.get("comments")),
    "delete_fixed_expense": lambda a: delete_fixed_expense(a["query"]),
    "list_variable_expenses": lambda a: list_variable_expenses(a.get("month")),
    "add_variable_expense": lambda a: add_variable_expense(a["date"], a["category"], a["description"], a["amount"]),
    "edit_variable_expense": lambda a: edit_variable_expense(a["query"], a.get("date"), a.get("category"), a.get("description"), a.get("amount")),
    "delete_variable_expense": lambda a: delete_variable_expense(a["query"], a.get("date")),
    "get_financial_summary": lambda a: get_financial_summary(a.get("month")),
}

def _system_prompt() -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d")
    return (
        f"You are the Finance Agent for Friday. You manage fixed and variable expense records in Google Sheets "
        f"and compute financial analytics. Use the available tools to fulfil the instruction. "
        f"Currency is {settings.CURRENCY}. "
        f"Today's date is {today}. Always use YYYY-MM-DD format for dates. "
        f"IMPORTANT: Never assume missing fields. If the category, amount, or description is not clearly stated, ask the user to confirm before recording. "
        f"Return a concise plain-text result."
    )


def run_finance_agent(instruction: str) -> str:
    messages = [{"role": "user", "content": instruction}]

    response = _client.messages.create(
        model=settings.NOTES_AGENT_MODEL,
        max_tokens=2048,
        system=[{"type": "text", "text": _system_prompt(), "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=messages,
    )

    while response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                fn = _TOOL_FNS.get(block.name)
                result = fn(block.input) if fn else f"Unknown tool: {block.name}"
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })
        messages = [
            {"role": "user", "content": instruction},
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ]
        response = _client.messages.create(
            model=settings.NOTES_AGENT_MODEL,
            max_tokens=2048,
            system=[{"type": "text", "text": _system_prompt(), "cache_control": {"type": "ephemeral"}}],
            tools=TOOLS,
            messages=messages,
        )

    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return "Finance agent completed the task."
