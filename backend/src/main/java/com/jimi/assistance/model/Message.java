package com.jimi.assistance.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;

/** 对话消息记录（由前端在每轮问答后上报落库） */
@Data
public class Message {

    private Long id;

    @NotBlank(message = "用户标识不能为空")
    @Size(max = 64, message = "用户标识长度不能超过 64")
    private String userId;

    @Size(max = 64, message = "会话标识长度不能超过 64")
    private String sessionId;

    @NotBlank(message = "消息角色不能为空")
    @Pattern(regexp = "^(user|assistant)$", message = "消息角色只能是 user 或 assistant")
    private String role;

    @NotBlank(message = "消息内容不能为空")
    private String content;

    private Integer tokens;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
