from dataclasses import dataclass, field
from typing import Optional
import json


@dataclass
class Project:
    name: str = ""
    status: str = ""
    deadline: str = ""
    notes: str = ""


@dataclass
class Identity:
    name: str = ""
    preferred_name: str = ""
    age: Optional[int] = None
    timezone: str = ""
    location: str = ""
    language: str = "en"


@dataclass
class DailyRoutine:
    wake_time: str = ""
    sleep_time: str = ""
    work_hours: str = ""
    work_days: list = field(default_factory=list)
    habits: list = field(default_factory=list)


@dataclass
class Health:
    dietary_preferences: list = field(default_factory=list)
    dietary_restrictions: list = field(default_factory=list)
    fitness_goals: list = field(default_factory=list)
    notes: str = ""


@dataclass
class WorkAndProjects:
    role: str = ""
    active_projects: list = field(default_factory=list)
    skills: list = field(default_factory=list)
    work_style: str = ""


@dataclass
class Goals:
    short_term: list = field(default_factory=list)
    long_term: list = field(default_factory=list)


@dataclass
class Finance:
    google_sheet_id: str = ""
    monthly_income: Optional[float] = None
    currency: str = "SGD"
    budget_allocations: dict = field(default_factory=lambda: {
        "liabilities": None,
        "personal_expense": None,
    })
    savings_goals: list = field(default_factory=list)
    liabilities_list: list = field(default_factory=list)  # [{ id, title, amount, paid_month }]


@dataclass
class Preferences:
    communication_style: str = "casual"
    verbosity: str = "concise"
    hobbies: list = field(default_factory=list)
    entertainment: list = field(default_factory=list)
    calendar_urls: list = field(default_factory=list)


def _make(cls, data: dict):
    """Construct a dataclass from a dict, ignoring unknown keys."""
    import dataclasses
    valid = {f.name for f in dataclasses.fields(cls)}
    return cls(**{k: v for k, v in data.items() if k in valid})


def _migrate_preferences(prefs: dict) -> dict:
    """Rename legacy calendar_url → calendar_urls."""
    if "calendar_url" in prefs and "calendar_urls" not in prefs:
        url = prefs["calendar_url"]
        prefs = {**prefs, "calendar_urls": [url] if url else []}
    prefs.pop("calendar_url", None)
    return prefs


@dataclass
class FridayProfile:
    identity: Identity = field(default_factory=Identity)
    daily_routine: DailyRoutine = field(default_factory=DailyRoutine)
    health: Health = field(default_factory=Health)
    work_and_projects: WorkAndProjects = field(default_factory=WorkAndProjects)
    goals: Goals = field(default_factory=Goals)
    finance: Finance = field(default_factory=Finance)
    notes: list = field(default_factory=list)
    preferences: Preferences = field(default_factory=Preferences)

    def to_dict(self) -> dict:
        import dataclasses
        return dataclasses.asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, data: dict) -> "FridayProfile":
        return cls(
            identity=_make(Identity, data.get("identity", {})),
            daily_routine=_make(DailyRoutine, data.get("daily_routine", {})),
            health=_make(Health, data.get("health", {})),
            work_and_projects=_make(WorkAndProjects, data.get("work_and_projects", {})),
            goals=_make(Goals, data.get("goals", {})),
            finance=_make(Finance, data.get("finance", {})),
            notes=data.get("notes", []),
            preferences=_make(Preferences, _migrate_preferences(data.get("preferences", {}))),
        )
