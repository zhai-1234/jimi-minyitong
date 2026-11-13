package com.jimi.assistance.controller;

import com.jimi.assistance.model.Message;
import com.jimi.assistance.service.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MessageController.class)
class MessageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MessageService messageService;

    @Test
    void savesValidMessageAndReturnsCreated() throws Exception {
        Message saved = new Message();
        saved.setId(1L);
        saved.setUserId("u-1");
        saved.setRole("user");
        saved.setContent("如何申请低保？");
        when(messageService.saveMessage(any(Message.class))).thenReturn(saved);

        mockMvc.perform(post("/api/chat-messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"u-1\",\"role\":\"user\",\"content\":\"如何申请低保？\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.userId").value("u-1"));
    }

    @Test
    void rejectsMessageWithoutUserId() throws Exception {
        mockMvc.perform(post("/api/chat-messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"user\",\"content\":\"你好\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("用户标识不能为空"));
    }

    @Test
    void rejectsUnknownRole() throws Exception {
        mockMvc.perform(post("/api/chat-messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"u-1\",\"role\":\"admin\",\"content\":\"你好\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("消息角色只能是 user 或 assistant"));
    }

    @Test
    void listsMessagesByUserWithClampedLimit() throws Exception {
        Message m = new Message();
        m.setId(2L);
        m.setUserId("u-1");
        m.setRole("assistant");
        m.setContent("您好");
        when(messageService.listByUser(eq("u-1"), anyInt())).thenReturn(List.of(m));

        // 超过上限的 limit 会被收敛到 200，避免一次拉取过多数据
        mockMvc.perform(get("/api/chat-messages").param("userId", "u-1").param("limit", "9999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].content").value("您好"));

        org.mockito.Mockito.verify(messageService).listByUser("u-1", 200);
    }
}
