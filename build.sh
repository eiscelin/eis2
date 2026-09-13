#!/bin/bash
# Generates config.js from environment variables at build time.
# Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Project Settings > Environment Variables.
cat > config.js << EOF
window.APP_CONFIG = {"SUPABASE_URL":"${SUPABASE_URL:-}","SUPABASE_ANON_KEY":"${SUPABASE_ANON_KEY:-}"};
EOF
