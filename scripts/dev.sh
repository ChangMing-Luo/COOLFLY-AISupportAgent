#!/usr/bin/env bash
# COOLFLY 知识运营中台 开发服务启动/重启/停止脚本
# 用法: ./scripts/dev.sh {start|restart|stop|status}
#   start   启动后端(3311)+前端(5311)，必要时拉起 PG、migrate+seed
#   restart 停止现有进程后重新启动
#   stop    停止前后端进程（保留 PG 容器）
#   status  查看各服务状态
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app"
# 本机 PG 走 Docker（容器名 coolfly-kb-pg，pgvector/pg16，宿主 5432）
PG_CONTAINER="coolfly-kb-pg"
# 默认连接串：Docker 容器内只有 postgres 角色，显式指定用户名
export DATABASE_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/kb_console}"

SERVER_LOG="/tmp/coolfly-server.log"
WEB_LOG="/tmp/coolfly-web.log"

SERVER_PORT="${PORT:-3311}"
WEB_PORT="5311"
# 前端 vite dev server 端口固定 5311（见 app/web/vite.config.ts）

log() { printf '[dev.sh] %s\n' "$*"; }

# 在独立会话中启动后台进程（脱离调用者进程组，避免被父 shell 清理杀死）
detach() { # $1=工作目录 $2=日志文件 $3+=命令
  local cwd="$1" logfile="$2"; shift 2
  python3 -c '
import subprocess, sys
cwd, logfile, *cmd = sys.argv[1:]
with open(logfile, "a") as f:
    subprocess.Popen(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT,
                     stdin=subprocess.DEVNULL, start_new_session=True)
' "$cwd" "$logfile" "$@"
}

# 端口探测：$1=端口，返回 0=已监听
port_open() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# 精确杀掉占用端口的进程（不误伤其他项目）
kill_port() { # $1=端口 $2=服务名
  local pids
  pids="$(lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null
    sleep 1
    pids="$(lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null)"
    [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null
    log "已停止$2（端口 $1）"
  else
    log "$2 未在运行"
  fi
}

ensure_pg() {
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$PG_CONTAINER"; then
    log "PostgreSQL 容器 $PG_CONTAINER 运行中"
    return 0
  fi
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$PG_CONTAINER"; then
    log "PostgreSQL 容器存在但未运行，启动中..."
    docker start "$PG_CONTAINER" >/dev/null && log "PG 已启动"
  else
    log "未找到 $PG_CONTAINER 容器，尝试创建（需 pgvector/pgvector:pg16 镜像）"
    docker run -d --name "$PG_CONTAINER" \
      -e POSTGRES_USER=postgres -e POSTGRES_DB=kb_console \
      -p 5432:5432 --restart unless-stopped \
      pgvector/pgvector:pg16 >/dev/null
    log "PG 容器已创建"
  fi
  for _ in {1..15}; do
    docker exec "$PG_CONTAINER" pg_isready -U postgres -d kb_console >/dev/null 2>&1 && { log "PG 就绪"; return 0; }
    sleep 1
  done
  log "ERROR: PG 未就绪"; exit 1
}

ensure_db() {
  log "执行 migrate + seed（幂等）"
  ( cd "$APP" && corepack enable >/dev/null 2>&1 || true
    pnpm db:migrate && pnpm db:seed ) || { log "ERROR: migrate/seed 失败"; exit 1; }
  log "数据库就绪"
}

start_server() {
  if port_open "$SERVER_PORT"; then
    log "后端已在运行（端口 $SERVER_PORT），跳过"
    return 0
  fi
  log "启动后端 (端口 $SERVER_PORT)..."
  detach "$APP" "$SERVER_LOG" pnpm dev:server
  for _ in {1..30}; do
    port_open "$SERVER_PORT" && curl -sf "http://localhost:$SERVER_PORT/healthz" >/dev/null 2>&1 \
      && { log "后端就绪"; return 0; }
    sleep 1
  done
  log "ERROR: 后端启动超时，日志见 $SERVER_LOG"; tail -20 "$SERVER_LOG"; exit 1
}

start_web() {
  if port_open "$WEB_PORT"; then
    log "前端已在运行（端口 $WEB_PORT），跳过"
    return 0
  fi
  log "启动前端 (端口 $WEB_PORT)..."
  detach "$APP" "$WEB_LOG" pnpm dev:web
  for _ in {1..30}; do
    port_open "$WEB_PORT" && { log "前端就绪"; return 0; }
    sleep 1
  done
  log "ERROR: 前端启动超时，日志见 $WEB_LOG"; tail -20 "$WEB_LOG"; exit 1
}

stop_services() {
  kill_port "$SERVER_PORT" "后端"
  kill_port "$WEB_PORT" "前端"
}

case "${1:-start}" in
  start)
    ensure_pg
    ensure_db
    start_server
    start_web
    log "全部启动完成：后端 http://localhost:$SERVER_PORT 前端 http://localhost:$WEB_PORT"
    ;;
  restart)
    log "重启服务..."
    stop_services
    sleep 1
    ensure_pg
    ensure_db
    start_server
    start_web
    log "重启完成：后端 http://localhost:$SERVER_PORT 前端 http://localhost:$WEB_PORT"
    ;;
  stop)
    stop_services
    log "已停止（PG 容器 $PG_CONTAINER 保留运行）"
    ;;
  status)
    echo "后端($SERVER_PORT): $(port_open "$SERVER_PORT" && echo 运行中 || echo 未运行)"
    echo "前端($WEB_PORT):  $(port_open "$WEB_PORT" && echo 运行中 || echo 未运行)"
    echo "PG 容器:          $(docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER" && echo 运行中 || echo 未运行)"
    ;;
  *)
    echo "用法: $0 {start|restart|stop|status}"; exit 1
    ;;
esac
