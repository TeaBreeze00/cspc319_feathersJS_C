#!/bin/bash
cd /Users/shamsetibriz/cspc319_feathersJS_C

# Load environment variables from ui/.env so the MCP backend has
# GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, and ALLOW_NETWORK_TOOLS.
if [ -f ui/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source ui/.env
  set +a
fi

/Users/shamsetibriz/.nvm/versions/node/v22.22.0/bin/node dist/index.js
