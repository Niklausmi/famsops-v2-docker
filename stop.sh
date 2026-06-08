#!/usr/bin/env bash
# Famsops — stop all services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.famsops.pids"

echo -e "\n\033[1;33m[STOP]\033[0m  Stopping Famsops services…"

if [ ! -f "$PID_FILE" ]; then
  echo "  No PID file found — nothing to stop."
  exit 0
fi

STOPPED=0
while IFS= read -r pid; do
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "  Stopped PID $pid"
    STOPPED=$((STOPPED + 1))
  fi
done < "$PID_FILE"

rm -f "$PID_FILE"

if [ "$STOPPED" -eq 0 ]; then
  echo "  No active processes found."
else
  echo -e "\033[0;32m[OK]\033[0m    $STOPPED service(s) stopped."
fi

echo ""
