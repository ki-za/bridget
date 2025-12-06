!# /bin/bash

# auto detects my local ip
# binds the hugo server to `0.0.0.0`
# sets the `baseURL` to network accesible address

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${BLUE}Bridget Mobile Development Server${NC}"
echo ""

if [[ "$OSTYPE" == "linux-gnu" ]]; then
  IP = $(hostname -I | awk '{print $1}')
else
  echo "Couldn't detect IP, likely not running linux-gnu"
  IP = "localhost"
fi

PORT=1313

echo "${GREEN} Mobile URL:${NC}"
echo "${BLUE} https://${IP}:${PORT}${NC}"
echo ""
echo "Starting server ..."
# start vite dev server

hugo server --source=exampleSite --gc -D \
  --disableFastRender --watch --logiLevel info \
  --bind 0.0.0.0 \
  --baseURL http://${IP}:${PORT}

trap "kill $VITE_PID 2>/dev/null/" EXIT

# to make executable
# chmod +x dev-mobile.sh
#
# run:
# $./dev_mobile.sh
