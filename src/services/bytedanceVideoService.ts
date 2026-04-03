/**
 * BytePlus ModelArk — Seedance Video Generation Service
 * API docs: https://docs.byteplus.com/en/docs/ModelArk/1366799
 *
 * Flow: POST /contents/generations/tasks → task_id
 *       GET  /contents/generations/tasks/{task_id} → poll until succeeded
 *       response.content.video_url → download → blob URL
 */

const BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const VIDEO_TASKS = `${BASE_URL}/contents/generations/tasks`;

// ─── Vertex AI–style model map: UI label → Seedance model ID ─────────────────
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

export interface SeedanceOptions {
  model?: string;           // UI model key (from SEEDANCE_MODEL_MAP) or raw Seedance ID
  resolution?: '480p' | '720p' | '1080p';
  ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
  duration?: number;        // 2–12 seconds
  generateAudio?: boolean;  // Seedance 1.5 Pro supports native audio
}

// ─── Create task ──────────────────────────────────────────────────────────────

export const seedanceStart = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  options: SeedanceOptions = {},
): Promise<string> => {
  const apiKey = getArkApiKey();
  if (!apiKey) throw new Error('ARK API Key missing. Please enter it in Settings.');

  // Resolve model ID
  const rawModel = options.model ?? 'seedance-1-5-pro';
  const modelId = SEEDANCE_MODEL_MAP[rawModel] ?? rawModel;

  const content: object[] = [{ type: 'text', text: prompt }];
  if (image) {
    // ByteDance accepts data URLs directly in image_url
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.data}` },
    });
  }

  const body: Record<string, unknown> = {
    model: modelId,
    content,
    resolution: options.resolution ?? '720p',
    ratio: options.ratio ?? '16:9',
    duration: options.duration ?? 5,
    generate_audio: options.generateAudio ?? true, // Seedance 1.5 Pro: native audio
    watermark: false,
  };

  const res = await fetch(VIDEO_TASKS, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Seedance create failed (${res.status}): ${JSON.stringify(data)}`);
  if (!data.id) throw new Error('Seedance: no task id returned');
  return data.id as string;
};

// ─── Poll task ────────────────────────────────────────────────────────────────

export const seedancePoll = async (
  taskId: string,
  onProgress?: (msg: string) => void,
  timeoutMs = 10 * 60 * 1000,
): Promise<string> => {
  const apiKey = getArkApiKey();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    if (onProgress) onProgress('Generating video via Seedance… this may take a few minutes.');

    const res = await fetch(`${VIDEO_TASKS}/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const data = await res.json();

    if (data.status === 'succeeded') {
      const videoUrl: string = data.content?.video_url;
      if (!videoUrl) throw new Error('Seedance succeeded but no video_url in response');

      // Download from ByteDance temp URL (pre-signed, no auth needed) → blob
      const dlRes = await fetch(videoUrl);
      if (!dlRes.ok) throw new Error(`Failed to download Seedance video: ${dlRes.statusText}`);
      const blob = await dlRes.blob();
      return URL.createObjectURL(blob);
    }

    if (['failed', 'expired', 'cancelled'].includes(data.status)) {
      throw new Error(`Seedance task ${data.status}: ${data.error?.message ?? 'Unknown error'}`);
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
