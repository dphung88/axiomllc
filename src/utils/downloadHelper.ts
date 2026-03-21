/**
 * downloadFile — saves a blob to user's chosen directory (via File System Access API)
 * or falls back to standard browser download if no directory handle is set.
 *
 * Priority:
 *  1. directoryHandle (user picked a folder in Settings) → save directly there
 *  2. Fallback → anchor download → browser's default Downloads folder
 */
export const downloadFile = async (
  blob: Blob,
  filename: string,
  directoryHandle: FileSystemDirectoryHandle | null
): Promise<void> => {
  // 1. Try saving to user-selected directory via File System Access API
  if (directoryHandle) {
    try {
      // requestPermission is part of File System Access API but not in TS lib yet
      const handle = directoryHandle as any;
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return; // ✅ Saved directly to chosen folder
      }
    } catch (err) {
      console.warn('[download] Directory write failed, falling back to browser download:', err);
    }
  }

  // 2. Fallback: standard browser anchor download → Downloads folder
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay revoke so Safari has time to process before blob URL is freed
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 30000);
};

/**
 * fetchAndDownload — fetches a URL and calls downloadFile.
 * Handles both data: URLs (base64 images from Gemini) and https: URLs (Supabase Storage).
 */
export const fetchAndDownload = async (
  url: string,
  filename: string,
  directoryHandle: FileSystemDirectoryHandle | null
): Promise<void> => {
  let blob: Blob;

  if (url.startsWith('data:')) {
    // data: URL — convert base64 to blob directly (fetch() returns ok=false for data: URLs)
    const [header, base64] = url.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    // https: URL (Supabase Storage etc.) — fetch normally
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    blob = await response.blob();
  }

  await downloadFile(blob, filename, directoryHandle);
};
