#! /bin/bash
ip=$(hostname -i | awk '{print $1}')
PORT=1313
echo "Starting server ..."
# start vite dev server
pnpm run vite:dev &
VITE_PID=$!
# Start Hugo server with network binding
hugo server --source=exampleSite --gc -D \
  --disableFastRender --watch --logLevel info \
  --bind 0.0.0.0 \
  --baseURL http://${ip}:${PORT}
trap "kill $VITE_PID 2>/dev/null" EXIT
