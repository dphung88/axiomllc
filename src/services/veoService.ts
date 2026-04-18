import { GoogleGenAI } from '@google/genai';
import { getApiKey, getUseVertexAI, getSupabaseEdgeUrl, getSupabaseEdgeHeaders } from './apiConfig';

export const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please enter your API key in Settings.');
  return new GoogleGenAI({ apiKey });
};

// ─── Vertex AI mode (routes through Supabase Edge Functions → GCP billing → $300 credit) ───

/**
 * Vertex AI publisher model IDs (production -001 suffix) differ from Gemini Developer API names (-preview suffix).
 * Google has updated Veo model names — the new production IDs on Vertex AI are:
 *   veo-3.1-generate-001      (standard quality, supports audio)
 *   veo-3.1-fast-generate-001 (faster generation, supports audio)
 * Legacy veo-2.0-generate-001 deprecated → migrates to veo-3.1-generate-001 by June 30 2026.
 */
const VERTEX_MODEL_MAP: Record<string, string> = {
  'veo-3.1-fast-generate-preview': 'veo-3.1-fast-generate-001', // Gemini fast preview → Vertex fast production
  'veo-3.1-generate-preview':      'veo-3.1-generate-001',       // Gemini HQ preview → Vertex HQ production
  'veo-3-generate-preview':        'veo-3.1-generate-001',       // old Gemini name → Vertex production
  'veo-3.0-generate-preview':      'veo-3.1-generate-001',       // old preview name → new production name
  'veo-3.0-generate-001':          'veo-3.1-generate-001',       // deprecated → new production name
  'veo-3.0-fast-generate-001':     'veo-3.1-fast-generate-001',  // deprecated → new fast production name
  'veo-2.0-generate-001':          'veo-2.0-generate-001',       // still valid until June 30 2026
};

const isVeo3Model = (model: string) => model.includes('veo-3');

const vertexStart = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  aspectRatio = '16:9',
  model = 'veo-2.0-generate-001',
): Promise<string> => {
  const vertexModel = VERTEX_MODEL_MAP[model] ?? 'veo-2.0-generate-001';
  const generateAudio = isVeo3Model(vertexModel); // Veo 3 supports audio; Veo 2 does not
  const edgeUrl = getSupabaseEdgeUrl();
  const res = await fetch(`${edgeUrl}/veo-start`, {
    method: 'POST',
    headers: { ...getSupabaseEdgeHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image, aspectRatio, model: vertexModel, generateAudio }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Vertex AI (veo-start): ${data.error}`);
  if (!data.operationName) throw new Error('veo-start returned no operationName');
  return data.operationName;
};

const vertexPoll = async (
  operationName: string,
  onProgress?: (msg: string) => void,
  model = 'veo-2.0-generate-001',
): Promise<string> => {
  const vertexModel = VERTEX_MODEL_MAP[model] ?? 'veo-2.0-generate-001'; // already mapped by vertexStart
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
      headers: { ...getSupabaseEdgeHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationName, model: vertexModel }),
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
    return { _vertexOperation: operationName, _vertexModel: model };
  }

  // ── Gemini Developer API ──
  const ai = getAiClient();
  const config: any = {
    numberOfVideos: 1,
    resolution: resolution === '1080p' ? '720p' : resolution,
    aspectRatio,
  };

  // Veo 3 supports native audio/voiceover generation — must be explicitly enabled
  if (isVeo3Model(model)) {
    config.generateAudio = true;
  }

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
    return await vertexPoll(result._vertexOperation, onProgress, result._vertexModel);
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
