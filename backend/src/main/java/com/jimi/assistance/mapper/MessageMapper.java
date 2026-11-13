package com.jimi.assistance.mapper;

import com.jimi.assistance.model.Message;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MessageMapper {

    @Insert("INSERT INTO messages (user_id, session_id, role, content, tokens) "
            + "VALUES (#{userId}, #{sessionId}, #{role}, #{content}, #{tokens})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Message message);

    @Select("SELECT id, user_id, session_id, role, content, tokens, create_time, update_time "
            + "FROM messages WHERE user_id = #{userId} ORDER BY id DESC LIMIT #{limit}")
    List<Message> selectByUserId(@Param("userId") String userId, @Param("limit") int limit);
}
