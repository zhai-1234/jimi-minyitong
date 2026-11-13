# 基米民易通 - 问答记录服务（Spring Boot）

负责对话消息的落库与查询，供前端可选上报、后续做对话分析与效果评估。

## 技术栈

Spring Boot 3.5 · MyBatis 3 · MySQL 8 · Jakarta Validation · JUnit 5 + MockMvc

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/chat-messages` | 保存一条对话消息（参数校验，返回 201） |
| GET | `/api/chat-messages?userId=&limit=` | 按用户查询历史消息（limit 上限 200） |

统一响应体：

```json
{ "code": 0, "message": "success", "data": { ... } }
```

参数校验失败返回 400 与具体字段错误信息，未处理异常统一返回 500，不会把堆栈暴露给前端。

## 本地运行

1. 建库建表：

```bash
mysql -u root -p < src/main/resources/db/schema.sql
```

2. 启动（数据库连接通过环境变量注入，默认 `localhost:3306/ai`、用户 `root`、空密码）：

```bash
# Windows
set DB_URL=jdbc:mysql://localhost:3306/ai?useSSL=false&serverTimezone=Asia/Shanghai
set DB_USER=root
set DB_PASSWORD=你的密码
mvnw.cmd spring-boot:run
```

```bash
# macOS / Linux
export DB_PASSWORD=你的密码
./mvnw spring-boot:run
```

支持的环境变量：`DB_URL` `DB_USER` `DB_PASSWORD` `SERVER_PORT` `CORS_ALLOWED_ORIGINS`。

## 测试

```bash
./mvnw test
```

`MessageControllerTest`（4 条，`@WebMvcTest` 切片）覆盖：正常保存、缺失用户标识、非法角色、查询参数上限收敛；`MessageMapperTest`（2 条，H2 内存库）覆盖：插入回填自增主键、按用户倒序查询。

## 目录结构

```
src/main/java/com/jimi/assistance/
├── AssistanceApplication.java
├── controller/   # REST 接口
├── service/      # 业务逻辑
├── mapper/       # MyBatis Mapper（注解 SQL）
├── model/        # 实体（Jakarta Validation 校验注解）
├── config/       # CORS 等 Web 配置
└── common/       # 统一响应体、全局异常处理
```
