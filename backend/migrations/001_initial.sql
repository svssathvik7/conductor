CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    startup_variables TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    url TEXT NOT NULL DEFAULT '',
    headers TEXT NOT NULL DEFAULT '[]',
    body TEXT NOT NULL DEFAULT '',
    response_schema TEXT NOT NULL DEFAULT '[]',
    on_success TEXT NOT NULL DEFAULT 'CONTINUE',
    on_failure TEXT NOT NULL DEFAULT 'STOP'
);

CREATE TABLE IF NOT EXISTS conditions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    after_step_id TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
    expression TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'FAIL'
);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    startup_variable_values TEXT NOT NULL DEFAULT '{}',
    step_results TEXT NOT NULL DEFAULT '[]'
);
