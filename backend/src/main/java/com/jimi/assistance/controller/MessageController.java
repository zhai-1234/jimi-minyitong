package com.jimi.assistance.controller;

import com.jimi.assistance.common.ApiResponse;
import com.jimi.assistance.model.Message;
import com.jimi.assistance.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat-messages")
@RequiredArgsConstructor
public class MessageController {

    private static final int MAX_PAGE_SIZE = 200;

    private final MessageService messageService;

    /** 保存一条对话消息 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Message> receiveMessage(@Valid @RequestBody Message message) {
        return ApiResponse.ok(messageService.saveMessage(message));
    }

    /** 按用户查询历史消息（按时间倒序，limit 上限 200） */
    @GetMapping
    public ApiResponse<List<Message>> listMessages(
            @RequestParam String userId,
            @RequestParam(defaultValue = "50") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
        return ApiResponse.ok(messageService.listByUser(userId, safeLimit));
    }
}
