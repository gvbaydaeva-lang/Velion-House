#!/bin/zsh
set -e

PROJECT_DIR="/Users/gilyana08/Desktop/Курсор проекты/silica-home"
PID_FILE="$PROJECT_DIR/.server.pid"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/server.log"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "Устанавливаю зависимости (это нужно только один раз)..."
  npm install
fi

if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Сервер уже запущен (PID: $PID)"
    open "http://localhost:8080/"
    open "http://localhost:8080/admin"
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

echo "Запускаю сервер в фоне..."
nohup npm start > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

sleep 2
open "http://localhost:8080/"
open "http://localhost:8080/admin"

echo "Готово. Сайт и админка открыты в браузере."
echo "Логи: $LOG_FILE"
