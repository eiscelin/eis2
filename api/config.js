// Serverless function to serve Supabase config to the client
// Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Project Settings > Environment Variables
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
  };
  res.send(`window.APP_CONFIG = ${JSON.stringify(config)};`);
}
