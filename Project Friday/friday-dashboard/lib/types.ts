export interface FridayProfile {
  identity: {
    name: string;
    preferred_name: string;
    age: number | null;
    timezone: string;
    location: string;
    language: string;
  };
  daily_routine: {
    wake_time: string;
    sleep_time: string;
    work_hours: string;
    work_days: string[];
    habits: string[];
  };
  health: {
    dietary_preferences: string[];
    dietary_restrictions: string[];
    fitness_goals: string[];
    notes: string;
  };
  work_and_projects: {
    role: string;
    active_projects: { name: string; status: string; deadline: string; notes: string }[];
    skills: string[];
    work_style: string;
  };
  goals: {
    short_term: string[];
    long_term: string[];
  };
  finance: {
    google_sheet_id: string;
    monthly_income: number | null;
    currency: string;
    budget_allocations: { liabilities: number | null; personal_expense: number | null };
    savings_goals: string[];
    liabilities_list: Array<{ id: string; title: string; amount: number; notes?: string | null; paid_month: string | null }>;
  };
  notes: { text: string; timestamp: string }[];
  preferences: {
    communication_style: string;
    verbosity: string;
    hobbies: string[];
    entertainment: string[];
    calendar_urls: string[];
  };
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  status: "todo" | "in_progress" | "done" | "archived";
  priority: "low" | "normal" | "high";
  due_date: string | null;
  label: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface RoutineItem {
  id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  order_index: number;
  days: number[]; // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_date: string | null;
  created_at: string;
}

export interface Briefing {
  id: string;
  user_id: string;
  name: string;
  schedule_time: string;
  schedule_days: number[];
  widgets: string[];
  enabled: boolean;
  last_delivered_date: string | null;
  created_at: string;
}

export interface CaptureLogEntry {
  id: string;
  user_id: string;
  raw_text: string;
  routed_to: string;
  status: string;
  created_at: string;
}

export const defaultProfile: FridayProfile = {
  identity: { name: "", preferred_name: "", age: null, timezone: "", location: "", language: "en" },
  daily_routine: { wake_time: "", sleep_time: "", work_hours: "", work_days: [], habits: [] },
  health: { dietary_preferences: [], dietary_restrictions: [], fitness_goals: [], notes: "" },
  work_and_projects: { role: "", active_projects: [], skills: [], work_style: "" },
  goals: { short_term: [], long_term: [] },
  finance: { google_sheet_id: "", monthly_income: null, currency: "SGD", budget_allocations: { liabilities: null, personal_expense: null }, savings_goals: [], liabilities_list: [] },
  notes: [],
  preferences: { communication_style: "casual", verbosity: "concise", hobbies: [], entertainment: [], calendar_urls: [] },
};
