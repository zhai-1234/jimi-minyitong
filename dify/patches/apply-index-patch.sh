#!/usr/bin/env bash
# 将 Dify 1.9.1 向量索引重建补丁写入 api / worker 容器。
# 用法：
#   ./apply-index-patch.sh            # 只复制文件
#   ./apply-index-patch.sh --restart  # 复制后重启 api/worker 让补丁生效
#   ./apply-index-patch.sh --check    # 只检查是否已打补丁
set -euo pipefail

# Git Bash（MSYS）会把 docker exec 里的 /app/... 转换成 Windows 路径，
# 只对 exec 调用关闭转换；docker cp 仍需要正常转换源路径。
docker_exec() { MSYS_NO_PATHCONV=1 docker exec "$@"; }

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/deal_dataset_vector_index_task.py"
TARGET=/app/api/tasks/deal_dataset_vector_index_task.py
CONTAINERS=(docker-api-1 docker-worker-1)

check_one() {
  docker_exec "$1" grep -q "jimi-patch" "$TARGET" 2>/dev/null
}

case "${1:-}" in
  --check)
    for c in "${CONTAINERS[@]}"; do
      if ! docker ps --format '{{.Names}}' | grep -qx "$c"; then
        echo "SKIP  $c（容器未运行）"
      elif check_one "$c"; then
        echo "OK    $c 已打补丁"
      else
        echo "MISS  $c 未打补丁"
      fi
    done
    exit 0
    ;;
esac

for c in "${CONTAINERS[@]}"; do
  if ! docker ps --format '{{.Names}}' | grep -qx "$c"; then
    echo "跳过 $c（容器未运行）"
    continue
  fi
  docker cp "$SRC" "$c:$TARGET"
  if check_one "$c"; then
    echo "已写入 $c:$TARGET"
  else
    echo "写入后校验失败：$c" >&2
    exit 1
  fi
done

if [ "${1:-}" = "--restart" ]; then
  echo "重启 api / worker …"
  docker restart docker-api-1 docker-worker-1
fi

cat <<'EOF'
完成。若未使用 --restart，请重启 api/worker 或等下次容器启动后再验证：
  docker restart docker-api-1 docker-worker-1
注意：docker compose down/up 重建容器后需要重新执行本脚本，
或使用 docker-compose.patch.yml 挂载补丁文件（推荐）。
EOF
