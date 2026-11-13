# Dify 1.9.1 索引重建补丁

Dify 1.9.1 的 `deal_dataset_vector_index_task` 在重建知识库索引时，先对文档做了一次批量状态更新，再遍历原来的 ORM 对象读取 `id/doc_form`。批量更新会让这些对象过期，随后的访问触发 `DetachedInstanceError`，文档卡在 indexing。

本目录的补丁在批量更新**之前**把 `(id, doc_form)` 快照到普通元组里，循环只使用快照，从而避开 ORM 对象失效问题。改动很小，只涉及一个文件。

| 文件 | 说明 |
| --- | --- |
| `deal_dataset_vector_index_task.py` | 已打补丁的完整文件（供 `docker cp` 与挂载使用） |
| `deal_dataset_vector_index_task.py.orig` | 原始文件（Dify 1.9.1） |
| `deal_dataset_vector_index_task.patch` | 与原文件的 unified diff，便于审阅和升级时重新应用 |
| `apply-index-patch.sh` / `.ps1` | 幂等安装脚本（检查 / 复制 / 可选重启） |
| `docker-compose.patch.yml` | 通过 compose 覆盖挂载补丁（**推荐**，容器重建不丢） |

## 安装方式

### 方式 A：compose 挂载（推荐，持久）

```bash
export JIMI_PATCH_DIR=/绝对路径/基米民易通/dify/patches
docker compose -f docker-compose.yaml -f "$JIMI_PATCH_DIR/docker-compose.patch.yml" up -d
```

（Windows PowerShell：`$env:JIMI_PATCH_DIR='C:\...\dify\patches'`。）

### 方式 B：脚本写入容器

```bash
./apply-index-patch.sh --restart
# Windows: .\apply-index-patch.ps1 -Restart
```

脚本可重复执行；`--check` / `-Check` 只检查状态。容器重建后需重新执行。

## 升级 Dify 时的检查清单

1. 用新版镜像的原始文件重新生成 diff，确认目标函数逻辑未大改；
2. 若已修复，删除挂载与脚本并更新本文档；
3. 重新验证：知识库 → 选择文档 → 重建索引，确认状态从 indexing 变为 completed。
