package com.jimi.assistance.service;

import com.jimi.assistance.mapper.MessageMapper;
import com.jimi.assistance.model.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageMapper messageMapper;

    public Message saveMessage(Message message) {
        messageMapper.insert(message);
        return message;
    }

    public List<Message> listByUser(String userId, int limit) {
        return messageMapper.selectByUserId(userId, limit);
    }
}
