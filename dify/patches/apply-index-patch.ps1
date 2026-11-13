# 将 Dify 1.9.1 向量索引重建补丁写入 api / worker 容器。
# 用法：
#   .\apply-index-patch.ps1            # 只复制文件
#   .\apply-index-patch.ps1 -Restart   # 复制后重启 api/worker 让补丁生效
#   .\apply-index-patch.ps1 -Check     # 只检查是否已打补丁
param(
    [switch]$Restart,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
# 控制台按 UTF-8 输出中文提示
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $dir 'deal_dataset_vector_index_task.py'
$target = '/app/api/tasks/deal_dataset_vector_index_task.py'
$containers = @('docker-api-1', 'docker-worker-1')

$running = docker ps --format '{{.Names}}'
function Test-Patched($c) {
    docker exec $c grep -q 'jimi-patch' $target 2>$null
    return ($LASTEXITCODE -eq 0)
}

if ($Check) {
    foreach ($c in $containers) {
        if ($running -notcontains $c) { Write-Host "SKIP  $c（容器未运行）"; continue }
        if (Test-Patched $c) { Write-Host "OK    $c 已打补丁" } else { Write-Host "MISS  $c 未打补丁" }
    }
    exit 0
}

foreach ($c in $containers) {
    if ($running -notcontains $c) {
        Write-Host "跳过 $c（容器未运行）"
        continue
    }
    docker cp $src "${c}:$target"
    if (Test-Patched $c) {
        Write-Host "已写入 ${c}:$target"
    } else {
        Write-Error "写入后校验失败：$c"
        exit 1
    }
}

if ($Restart) {
    Write-Host '重启 api / worker …'
    docker restart docker-api-1 docker-worker-1
}

Write-Host @'
完成。若未使用 -Restart，请重启 api/worker 或等下次容器启动后再验证：
  docker restart docker-api-1 docker-worker-1
注意：docker compose down/up 重建容器后需要重新执行本脚本，
或使用 docker-compose.patch.yml 挂载补丁文件（推荐）。
'@
