-- 对话消息表
CREATE TABLE IF NOT EXISTS messages (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id     VARCHAR(64)  NOT NULL COMMENT '用户标识',
    session_id  VARCHAR(64)  DEFAULT NULL COMMENT 'Dify 会话 ID',
    role        VARCHAR(16)  NOT NULL COMMENT '消息角色：user / assistant',
    content     TEXT         NOT NULL COMMENT '消息内容',
    tokens      INT          DEFAULT NULL COMMENT '消耗 token 数',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_user_id (user_id),
    KEY idx_session_id (session_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='对话消息记录';
