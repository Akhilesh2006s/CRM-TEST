/**
 * Normalize a picked image/PDF into an uploadable PDF File/Blob.
 * Images are converted to PDF on the client so upload works even when
 * the API only accepts application/pdf.
 */

export async function prepareFeedbackUpload(asset: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  file?: File | null;
}): Promise<{ blobOrFile: Blob | { uri: string; type: string; name: string }; fileName: string; mime: string }> {
  const rawName = (asset.name || asset.file?.name || 'feedback').toLowerCase();
  const rawMime = (asset.mimeType || asset.file?.type || '').toLowerCase();
  const isPdf =
    rawMime === 'application/pdf' ||
    rawName.endsWith('.pdf') ||
    (asset.file && asset.file.type === 'application/pdf');

  if (isPdf) {
    if (asset.file) {
      return {
        blobOrFile: asset.file,
        fileName: asset.file.name || 'feedback.pdf',
        mime: 'application/pdf',
      };
    }
    if (typeof fetch !== 'undefined') {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      return { blobOrFile: blob, fileName: 'feedback.pdf', mime: 'application/pdf' };
    }
    return {
      blobOrFile: { uri: asset.uri, type: 'application/pdf', name: 'feedback.pdf' },
      fileName: 'feedback.pdf',
      mime: 'application/pdf',
    };
  }

  // Convert any image → JPEG → PDF (client-side)
  const { jpegBytes, width, height } = await imageSourceToJpegBytes(asset);
  const pdfBytes = jpegBytesToPdf(jpegBytes, width, height);
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  return { blobOrFile: pdfBlob, fileName: 'feedback.pdf', mime: 'application/pdf' };
}

async function imageSourceToJpegBytes(asset: {
  uri: string;
  file?: File | null;
}): Promise<{ jpegBytes: Uint8Array; width: number; height: number }> {
  // Browser: canvas re-encode (handles PNG/WebP/HEIC when browser can decode)
  if (typeof document !== 'undefined') {
    const jpegBlob = await imageToJpegBlob(asset.file || asset.uri);
    const buf = new Uint8Array(await jpegBlob.arrayBuffer());
    const dims = readJpegSize(buf) || { width: 1200, height: 1600 };
    return { jpegBytes: buf, width: dims.width, height: dims.height };
  }

  // Native: fetch bytes from uri
  const res = await fetch(asset.uri);
  const blob = await res.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (isJpegBytes(bytes)) {
    const dims = readJpegSize(bytes) || { width: 1200, height: 1600 };
    return { jpegBytes: bytes, width: dims.width, height: dims.height };
  }

  // Non-JPEG on native without canvas — cannot convert; ask for JPG or use browser
  throw new Error(
    'This image format could not be converted on device. Please use a JPG photo, or open this screen in the browser to upload PNG.',
  );
}

async function imageToJpegBlob(source: File | string): Promise<Blob> {
  const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await loadHtmlImage(objectUrl);
    const canvas = document.createElement('canvas');
    const maxSide = 2000;
    let width = img.width;
    let height = img.height;
    if (width > maxSide || height > maxSide) {
      const scale = maxSide / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not convert image'))),
        'image/jpeg',
        0.9,
      );
    });
  } finally {
    if (typeof source !== 'string') {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {
        /* ignore */
      }
    }
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image. Try JPG or PNG.'));
    img.src = src;
  });
}

function isJpegBytes(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isJpegBytes(bytes)) return null;
  let i = 2;
  while (i < bytes.length - 8) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) + bytes[i + 3];
    // SOF0 / SOF2
    if (marker === 0xc0 || marker === 0xc2) {
      const height = (bytes[i + 5] << 8) + bytes[i + 6];
      const width = (bytes[i + 7] << 8) + bytes[i + 8];
      if (width > 0 && height > 0) return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

/** Build a one-page PDF that embeds a baseline JPEG (DCTDecode). */
function jpegBytesToPdf(jpeg: Uint8Array, imgW: number, imgH: number): Uint8Array {
  const pageW = 595;
  const pageH = 842;
  const margin = 36;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const scale = Math.min(availW / imgW, availH / imgH, 1);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [0];

  const pushText = (s: string) => {
    const b = encoder.encode(s);
    parts.push(b);
    offset += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    offset += b.length;
  };
  const startObj = (n: number) => {
    offsets[n] = offset;
    pushText(`${n} 0 obj\n`);
  };
  const endObj = () => pushText('endobj\n');

  pushText('%PDF-1.4\n');

  startObj(1);
  pushText('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObj();

  startObj(2);
  pushText('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n');
  endObj();

  startObj(3);
  pushText(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n`,
  );
  endObj();

  startObj(4);
  pushText(
    `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  pushBytes(jpeg);
  pushText('\nendstream\n');
  endObj();

  const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q\n`;
  startObj(5);
  pushText(`<< /Length ${content.length} >>\nstream\n${content}endstream\n`);
  endObj();

  const xrefStart = offset;
  pushText(`xref\n0 6\n`);
  pushText('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
