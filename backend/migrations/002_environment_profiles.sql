CREATE TABLE IF NOT EXISTS environment_profiles (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    variables TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
