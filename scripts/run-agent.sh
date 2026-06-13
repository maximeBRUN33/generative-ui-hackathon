#!/bin/bash
cd "$(dirname "$0")/../agent" || exit 1

# Free port 8123 before launching. `uvicorn --reload` spawns a worker child
# (multiprocessing-fork) that actually binds the socket; on Ctrl+C that child
# can be orphaned and keep the port, causing "[Errno 48] Address already in
# use" on the next start. Kill any leftover listener first so restarts always
# work.
PIDS=$(lsof -tiTCP:8123 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "run-agent: freeing port 8123 (stale pids: $PIDS)"
  kill -9 $PIDS 2>/dev/null
  sleep 1
fi

# exec so SIGINT/SIGTERM reach uvicorn directly (cleaner shutdown, fewer orphans).
exec uv run uvicorn main:app --port 8123 --reload
