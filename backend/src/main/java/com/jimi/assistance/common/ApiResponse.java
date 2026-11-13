package com.jimi.assistance.common;

import lombok.AllArgsConstructor;
import lombok.Data;

/** 统一接口响应体 */
@Data
@AllArgsConstructor
public class ApiResponse<T> {

    /** 业务状态码：0 表示成功 */
    private int code;

    private String message;

    private T data;

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(0, "success", data);
    }

    public static <T> ApiResponse<T> fail(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }
}
