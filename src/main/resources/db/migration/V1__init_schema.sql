CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    subtitle VARCHAR(120) NOT NULL DEFAULT 'Workspace Member',
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    avatar_url TEXT,
    token_limit BIGINT NOT NULL DEFAULT 250000,
    created_at BIGINT NOT NULL,
    last_active_at BIGINT NOT NULL
);

CREATE TABLE provider_tokens (
    provider VARCHAR(32) PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by_admin_id UUID
);

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    model VARCHAR(80) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_chat_messages_session_created ON chat_messages(chat_session_id, created_at ASC);

CREATE TABLE token_usage_records (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    model VARCHAR(80) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    prompt_tokens BIGINT NOT NULL DEFAULT 0,
    completion_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_token_usage_user ON token_usage_records(user_id);
CREATE INDEX idx_token_usage_model ON token_usage_records(model);
