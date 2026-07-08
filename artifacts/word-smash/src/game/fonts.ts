// Self-hosted font loading via XHR + FontFace ArrayBuffer.
// Required for the offline file:// WebView where Google Fonts CDN is unavailable.
// file:// XHR returns status 0 on success — treated as success below.

function loadBinary(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`loadBinary ${url} → ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error(`loadBinary XHR error: ${url}`));
    xhr.send();
  });
}

export async function loadFonts(): Promise<void> {
  try {
    const base = import.meta.env.BASE_URL;
    const buf = await loadBinary(`${base}fonts/fredoka-one.woff2`);
    const face = new FontFace('Fredoka One', buf);
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    // Fall back to system fonts declared in CSS font stacks.
    console.warn('Font load failed, using system fallback', err);
  }
}
