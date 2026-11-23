ALTER TABLE chat_sessions ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_sessions ADD COLUMN deleted_at BIGINT;

CREATE INDEX idx_chat_sessions_user_deleted_updated
    ON chat_sessions(user_id, deleted, updated_at DESC);
