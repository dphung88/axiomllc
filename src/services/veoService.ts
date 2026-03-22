import { GoogleGenAI } from '@google/genai';
import { getApiKey, getUseVertexAI, getSupabaseEdgeUrl } from './apiConfig';

export const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please enter your API key in Settings.');
  return new GoogleGenAI({ apiKey });
};

// ─── Vertex AI mode (routes through Supabase Edge Functions → GCP billing → $300 credit) ───

const vertexStart = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  aspectRatio = '16:9',
  model = 'veo-2.0-generate-001',
): Promise<string> => {
  const edgeUrl = getSupabaseEdgeUrl();
  const res = await fetch(`${edgeUrl}/veo-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image, aspectRatio, model }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Vertex AI (veo-start): ${data.error}`);
  if (!data.operationName) throw new Error('veo-start returned no operationName');
  return data.operationName;
};

const vertexPoll = async (
  operationName: string,
  onProgress?: (msg: string) => void,
): Promise<string> => {
  const edgeUrl = getSupabaseEdgeUrl();
  const startTime = Date.now();
  const timeoutMs = 12 * 60 * 1000; // 12 minutes

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Video generation timed out after 12 minutes.');
    }

    await new Promise(r => setTimeout(r, 10000));
    if (onProgress) onProgress('Generating via Vertex AI… this may take a few minutes.');

    const res = await fetch(`${edgeUrl}/veo-poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationName }),
    });

    const data = await res.json();
    if (data.error) throw new Error(`Vertex AI (veo-poll): ${data.error}`);

    if (data.done) {
      if (!data.url) throw new Error('veo-poll returned done but no url');
      return data.url; // Supabase Storage public URL
    }
    // data.done === false → keep polling
  }
};

// ─── Gemini Developer API mode (direct, charges Gemini billing) ───────────────────────────

export const generateVideo = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  lastFrame?: { data: string; mimeType: string },
  aspectRatio: '16:9' | '9:16' = '16:9',
  resolution: '720p' | '1080p' = '720p',
  model: string = 'veo-2.0-generate-001',
): Promise<any> => {
  if (getUseVertexAI()) {
    // Return a special object that pollVideoOperation will recognise
    const operationName = await vertexStart(prompt, image, aspectRatio, model);
    return { _vertexOperation: operationName };
  }

  // ── Gemini Developer API ──
  const ai = getAiClient();
  const config: any = {
    numberOfVideos: 1,
    resolution: resolution === '1080p' ? '720p' : resolution,
    aspectRatio,
  };

  if (lastFrame) {
    config.lastFrame = { imageBytes: lastFrame.data, mimeType: lastFrame.mimeType };
  }

  const req: any = { model, prompt, config };
  if (image) {
    req.image = { imageBytes: image.data, mimeType: image.mimeType };
  }

  return await ai.models.generateVideos(req);
};

export const pollVideoOperation = async (
  result: any,
  onProgress?: (msg: string) => void,
): Promise<string> => {
  // ── Vertex AI mode: result is { _vertexOperation: operationName } ──
  if (result?._vertexOperation) {
    return await vertexPoll(result._vertexOperation, onProgress);
  }

  // If Vertex AI is enabled but operationName is missing, don't fall through to AI Studio
  if (getUseVertexAI()) {
    throw new Error('Vertex AI mode enabled but no operationName returned from veo-start. Check GOOGLE_SA_JSON secret in Supabase.');
  }

  // ── Gemini Developer API mode ──
  const ai = getAiClient();
  let currentResult = result;
  const startTime = Date.now();
  const timeoutMs = 10 * 60 * 1000;

  while (!currentResult.done) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Video generation timed out after 10 minutes.');
    }
    if (onProgress) onProgress('Generating video… this may take a few minutes.');
    await new Promise(resolve => setTimeout(resolve, 10000));
    currentResult = await ai.operations.getVideosOperation({ operation: currentResult });
  }

  const downloadLink = currentResult.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error('Video generation failed or returned no URI.');

  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please enter your key in Settings.');

  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: { 'x-goog-api-key': apiKey },
  });

  if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
