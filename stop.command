#!/bin/zsh
set -e

PROJECT_DIR="/Users/gilyana08/Desktop/Курсор проекты/silica-home"
PID_FILE="$PROJECT_DIR/.server.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "PID файл не найден. Возможно, сервер уже остановлен."
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Сервер остановлен (PID: $PID)."
else
  echo "Процесс с PID $PID не найден."
fi

rm -f "$PID_FILE"
