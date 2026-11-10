// Cloudinary uploads — story photos are stored publicly on the connected Cloudinary account
const cloudinaryConf = window.APP_CONFIG || {};
const cloudinaryReady = !!(cloudinaryConf.CLOUDINARY_CLOUD_NAME && cloudinaryConf.CLOUDINARY_UPLOAD_PRESET);

if (!cloudinaryReady) {
  console.info('Cloudinary not configured — story photos stay inline in the database');
}

// Unsigned upload: the cloud name and upload preset are safe to expose in the browser
async function cloudinaryUpload(blob) {
  if (!cloudinaryReady) throw new Error('Cloudinary is not connected');
  const body = new FormData();
  body.append('file', blob);
  body.append('upload_preset', cloudinaryConf.CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConf.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error((data.error && data.error.message) || 'Cloudinary upload failed');
  }
  return data.secure_url;
}
