CREATE TABLE IF NOT EXISTS messages (
    id          BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL,
    session_id  VARCHAR(64),
    role        VARCHAR(16) NOT NULL,
    content     TEXT        NOT NULL,
    tokens      INT,
    create_time TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
