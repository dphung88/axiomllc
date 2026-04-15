/**
 * BytePlus ModelArk — Seedance Video Generation Service
 * API docs: https://docs.byteplus.com/en/docs/ModelArk/1366799
 *
 * Flow: POST /contents/generations/tasks → task_id
 *       GET  /contents/generations/tasks/{task_id} → poll until succeeded
 *       response.content.video_url → download → blob URL
 */

// Video generation routes through Supabase Edge Functions to avoid CORS.
// (BytePlus video tasks endpoint blocks browser cross-origin requests.)
const getEdgeUrl = (): string => {
  const url = (import.meta.env as any).VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '';
};

// ─── Model map: UI label → Seedance model ID (confirmed from BytePlus docs) ───
// If BytePlus requires a custom inference endpoint (ep-xxxx), set it in
// Settings → Seedance Video Endpoint ID — that will override these values.
export const SEEDANCE_MODEL_MAP: Record<string, string> = {
  'seedance-1-5-pro':      'seedance-1-5-pro-251215',
  'seedance-1-0-pro-fast': 'seedance-1-0-pro-fast-251015',
  'seedance-1-0-pro':      'seedance-1-0-pro-250428',
};

export const getArkApiKey = (): string => {
  try {
    const saved = localStorage.getItem('studioSettings');
    if (saved) {
      const s = JSON.parse(saved);
      if (s.arkApiKey) return s.arkApiKey.trim();
    }
  } catch (_) {}
  // Fallback to env (Vercel VITE_ env vars)
  return (import.meta.env as any).VITE_ARK_API_KEY || '';
};

// Returns custom inference endpoint ID if set, otherwise falls back to SEEDANCE_MODEL_MAP lookup
export const getArkVideoEndpoint = (uiModel: string): string => {
  try {
    const saved = localStorage.getItem('studioSettings');
    if (saved) {
      const s = JSON.parse(saved);
      if (s.arkVideoEndpoint && s.arkVideoEndpoint.trim()) {
        return s.arkVideoEndpoint.trim();
      }
    }
  } catch (_) {}
  return SEEDANCE_MODEL_MAP[uiModel] ?? uiModel;
};

export interface SeedanceOptions {
  model?: string;           // UI model key (from SEEDANCE_MODEL_MAP) or raw Seedance ID
  resolution?: '480p' | '720p' | '1080p';
  ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
  duration?: number;        // 2–12 seconds
  generateAudio?: boolean;  // Seedance 1.5 Pro enables audio natively — ignored in request body
}

// ─── Create task ──────────────────────────────────────────────────────────────
// Per BytePlus docs: parameters are embedded as inline flags in the text prompt,
// NOT as separate top-level body fields.
// Correct format: "prompt text --ratio 16:9 --resolution 720p --duration 5 --camerafixed false"

export const seedanceStart = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  options: SeedanceOptions = {},
): Promise<string> => {
  const apiKey = getArkApiKey();
  if (!apiKey) throw new Error('ARK API Key missing. Please enter it in Settings.');

  // Resolve model ID — uses custom endpoint if set in Settings, else falls back to model map
  const rawModel = options.model ?? 'seedance-1-5-pro';
  const modelId = getArkVideoEndpoint(rawModel);

  // Validate ep-xxxx endpoint is configured (BytePlus requires it for video generation)
  if (!modelId || modelId === SEEDANCE_MODEL_MAP[rawModel]) {
    const hasCustomEndpoint = (() => {
      try {
        const s = JSON.parse(localStorage.getItem('studioSettings') || '{}');
        return !!(s.arkVideoEndpoint && s.arkVideoEndpoint.trim());
      } catch { return false; }
    })();
    if (!hasCustomEndpoint) {
      throw new Error(
        'BytePlus requires a custom inference endpoint for video generation. ' +
        'Go to Settings → ByteDance → "Seedance Video Endpoint ID" and enter your ep-xxxx ID. ' +
        '(BytePlus Console → Online Inference → Create Endpoint → copy the ep-xxxx ID)'
      );
    }
  }

  // Route through Supabase Edge Function to avoid CORS
  const edgeUrl = getEdgeUrl();
  if (!edgeUrl) throw new Error('VITE_SUPABASE_URL is not configured.');

  const res = await fetch(`${edgeUrl}/seedance-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      modelId,
      prompt,
      image,
      ratio:      options.ratio ?? '16:9',
      resolution: options.resolution ?? '720p',
      duration:   options.duration ?? 5,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!data.taskId) throw new Error(`seedance-start returned no taskId. Raw response: ${JSON.stringify(data)}`);
  return data.taskId as string;
};

// ─── Poll task ────────────────────────────────────────────────────────────────

export const seedancePoll = async (
  taskId: string,
  onProgress?: (msg: string) => void,
  timeoutMs = 10 * 60 * 1000,
): Promise<string> => {
  const apiKey = getArkApiKey();
  const deadline = Date.now() + timeoutMs;

  const edgeUrl = getEdgeUrl();
  if (!edgeUrl) throw new Error('VITE_SUPABASE_URL is not configured.');

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    if (onProgress) onProgress('Generating video via Seedance… this may take a few minutes.');

    const res = await fetch(`${edgeUrl}/seedance-poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, taskId }),
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    if (data.status === 'succeeded') {
      // Download the pre-signed video URL returned by the edge function
      const dlRes = await fetch(data.videoUrl);
      if (!dlRes.ok) throw new Error(`Failed to download Seedance video: ${dlRes.statusText}`);
      const blob = await dlRes.blob();
      return URL.createObjectURL(blob);
    }
    // status: queued | running → keep polling
  }

  throw new Error('Seedance video generation timed out after 10 minutes.');
};

// ─── Unified interface (mirrors veoService generateVideo + pollVideoOperation) ─

export const generateVideo = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  _lastFrame?: { data: string; mimeType: string }, // not supported by Seedance, ignored
  aspectRatio: '16:9' | '9:16' = '16:9',
  resolution: '720p' | '1080p' = '720p',
  model = 'seedance-1-5-pro',
): Promise<{ _seedanceTask: string; _model: string }> => {
  const taskId = await seedanceStart(prompt, image, {
    model,
    resolution,
    ratio: aspectRatio,
    generateAudio: true,
  });
  return { _seedanceTask: taskId, _model: model };
};

export const pollVideoOperation = async (
  result: { _seedanceTask: string; _model: string },
  onProgress?: (msg: string) => void,
): Promise<string> => {
  return seedancePoll(result._seedanceTask, onProgress);
};
