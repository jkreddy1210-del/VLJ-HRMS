#!/bin/sh
# Find and stop whatever uses a TCP port (Synology / Linux / Docker).
# Usage: sh scripts/stop-port.sh [port]
# Example: sh scripts/stop-port.sh 3000

PORT="${1:-3000}"
FOUND=0

echo "=== Checking port ${PORT} ==="

# 1) Docker containers publishing this host port
if command -v docker >/dev/null 2>&1; then
  echo ""
  echo "Docker containers:"
  docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null | grep -E ":${PORT}->|:${PORT}/" || echo "  (none matched in docker ps)"

  for name in $(docker ps --format '{{.Names}}' 2>/dev/null); do
    ports=$(docker port "$name" 2>/dev/null)
    if echo "$ports" | grep -q ":${PORT}$"; then
      FOUND=1
      echo ""
      echo "→ Port ${PORT} is used by Docker container: ${name}"
      echo "  Stopping container..."
      docker stop "$name" 2>/dev/null || sudo docker stop "$name"
      echo "  Container ${name} stopped."
    fi
  done
fi

# 2) fuser (try with sudo — required on Synology for other users' processes)
if command -v fuser >/dev/null 2>&1; then
  if fuser "${PORT}/tcp" >/dev/null 2>&1 || sudo fuser "${PORT}/tcp" >/dev/null 2>&1; then
    FOUND=1
    echo ""
    echo "→ Killing host process via fuser on port ${PORT}..."
    sudo fuser -k "${PORT}/tcp" 2>/dev/null || fuser -k "${PORT}/tcp" 2>/dev/null
  fi
fi

# 3) ss / netstat with sudo (IPv4 and IPv6)
echo ""
echo "Listeners on port ${PORT}:"
if command -v ss >/dev/null 2>&1; then
  sudo ss -tlnp 2>/dev/null | grep -E ":${PORT} |:${PORT}$" || ss -tlnp 2>/dev/null | grep -E ":${PORT} |:${PORT}$" || echo "  (none)"
  PIDS=$(sudo ss -tlnp 2>/dev/null | grep -E ":${PORT} |:${PORT}$" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u)
elif command -v netstat >/dev/null 2>&1; then
  sudo netstat -tlnp 2>/dev/null | grep ":${PORT} " || netstat -tlnp 2>/dev/null | grep ":${PORT} " || echo "  (none)"
  PIDS=$(sudo netstat -tlnp 2>/dev/null | grep ":${PORT} " | awk '{print $7}' | cut -d/ -f1 | sort -u)
else
  PIDS=""
fi

for pid in $PIDS; do
  case "$pid" in
    ""|"-"|*[^0-9]*) continue ;;
  esac
  FOUND=1
  echo "→ Killing PID ${pid}..."
  sudo kill "$pid" 2>/dev/null || kill "$pid" 2>/dev/null
  sleep 1
  sudo kill -9 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
done

# 4) Node / next processes (old dev server left running)
if command -v pgrep >/dev/null 2>&1; then
  NODE_PIDS=$(pgrep -f "next (dev|start)" 2>/dev/null)
  if [ -n "$NODE_PIDS" ]; then
    echo ""
    echo "Next.js processes still running:"
    ps -p $NODE_PIDS -o pid,cmd 2>/dev/null || ps $NODE_PIDS 2>/dev/null
    echo "→ Stopping Next.js processes..."
    for pid in $NODE_PIDS; do
      FOUND=1
      kill "$pid" 2>/dev/null || sudo kill "$pid" 2>/dev/null
    done
    sleep 1
    for pid in $NODE_PIDS; do
      kill -9 "$pid" 2>/dev/null || sudo kill -9 "$pid" 2>/dev/null
    done
  fi
fi

echo ""
if [ "$FOUND" = "0" ]; then
  echo "No process found (or need sudo). Try manually:"
  echo "  sudo ss -tlnp | grep ${PORT}"
  echo "  docker ps"
  echo "  sudo fuser -k ${PORT}/tcp"
else
  echo "Done. Verify port is free:"
  echo "  sudo ss -tlnp | grep ${PORT} || echo 'Port ${PORT} is free'"
fi
