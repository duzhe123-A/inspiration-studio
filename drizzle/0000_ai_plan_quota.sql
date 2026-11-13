CREATE TABLE ai_plan_quota (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  day TEXT NOT NULL,
  requests INTEGER NOT NULL
);
