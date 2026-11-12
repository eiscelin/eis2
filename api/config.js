// Serverless function to serve Supabase config to the client
// Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Project Settings > Environment Variables
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    // Unsigned upload preset: public by design, so the browser can upload directly
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    // Backup account, used when the primary one stops accepting uploads
    CLOUDINARY_CLOUD_NAME_BACKUP: process.env.CLOUDINARY_CLOUD_NAME_BACKUP || '',
    CLOUDINARY_UPLOAD_PRESET_BACKUP: process.env.CLOUDINARY_UPLOAD_PRESET_BACKUP || ''
  };
  res.send(`window.APP_CONFIG = ${JSON.stringify(config)};`);
}
