
// Import heic2any from CDN (which includes libheif)
importScripts('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');

self.onmessage = async function(e) {
  const { id, file, format, quality } = e.data;

  try {
    // console.log(`Worker processing file ${id}`);
    
    // Map format 'PNG'/'JPG'/'WebP' to MIME type
    let toType = 'image/png';
    if (format === 'JPG') toType = 'image/jpeg';
    if (format === 'WebP') toType = 'image/webp';

    const conversionQuality = quality / 100;

    const result = await heic2any({
      blob: file,
      toType: toType,
      quality: conversionQuality,
    });

    const resultBlob = Array.isArray(result) ? result[0] : result;

    self.postMessage({ id, status: 'success', resultBlob });
  } catch (error) {
    console.error(`Worker error for ${id}:`, error);
    self.postMessage({ id, status: 'error', error: error.toString() });
  }
};
