#!/bin/bash
# Generates config.js from environment variables at build time.
# Trigger redeploy to pick up new Vercel environment variables.
# Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Project Settings > Environment Variables.
cat > config.js << EOF
window.APP_CONFIG = {"SUPABASE_URL":"${SUPABASE_URL:-}","SUPABASE_ANON_KEY":"${SUPABASE_ANON_KEY:-}"};
EOF
