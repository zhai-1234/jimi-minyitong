package com.jimi.assistance.mapper;

import com.jimi.assistance.model.Message;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.jdbc.Sql;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Mapper 集成测试：H2 内存库（MySQL 兼容模式）上执行真实 SQL */
@MybatisTest
@Sql(scripts = "/schema-h2.sql")
class MessageMapperTest {

    @Autowired
    private MessageMapper messageMapper;

    @Test
    void insertsMessageAndReturnsGeneratedKey() {
        Message message = new Message();
        message.setUserId("u-1");
        message.setSessionId("conv-1");
        message.setRole("user");
        message.setContent("如何申请低保？");

        int rows = messageMapper.insert(message);

        assertThat(rows).isEqualTo(1);
        assertThat(message.getId()).isNotNull();
    }

    @Test
    void selectsMessagesByUserNewestFirst() {
        insert("u-1", "第一条");
        insert("u-1", "第二条");
        insert("u-2", "其他用户的消息");

        List<Message> messages = messageMapper.selectByUserId("u-1", 10);

        assertThat(messages).hasSize(2);
        assertThat(messages.get(0).getContent()).isEqualTo("第二条");
        assertThat(messages).allSatisfy(m -> assertThat(m.getUserId()).isEqualTo("u-1"));
    }

    private void insert(String userId, String content) {
        Message message = new Message();
        message.setUserId(userId);
        message.setRole("user");
        message.setContent(content);
        messageMapper.insert(message);
    }
}
