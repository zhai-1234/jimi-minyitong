package com.jimi.assistance.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis 配置。
 * 单独放置 @MapperScan，避免启动类注解在 @WebMvcTest 切片的测试上下文中
 * 也触发 Mapper 创建（切片测试不加载 SqlSessionFactory）。
 */
@Configuration
@MapperScan("com.jimi.assistance.mapper")
public class MyBatisConfig {
}
