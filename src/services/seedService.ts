/**
 * BytePlus ModelArk — Seed 2.0 LLM Service (OpenAI-compatible)
 * Replaces geminiService.ts for all text / multimodal / script tasks.
 * API docs: https://docs.byteplus.com/en/docs/ModelArk/1399008
 */

import { getArkApiKey } from './bytedanceVideoService';
import { saveToStudioGallery } from './supabase';

const BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const CHAT_URL = `${BASE_URL}/chat/completions`;
const IMAGE_URL = `${BASE_URL}/images/generations`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(text: string): string {
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const objStart = s.indexOf('{'); const objEnd = s.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1) return s.substring(objStart, objEnd + 1);
  const arrStart = s.indexOf('['); const arrEnd = s.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1) return s.substring(arrStart, arrEnd + 1);
  return s;
}

const getLlmModel = (): string => {
  try {
    const s = localStorage.getItem('studioSettings');
    if (s) return JSON.parse(s).llmModel || 'seed-2-0-lite-260228';
  } catch (_) {}
  return 'seed-2-0-lite-260228';
};

async function seedChat(messages: object[], model?: string): Promise<string> {
  const apiKey = getArkApiKey();
  if (!apiKey) throw new Error('ARK API Key missing. Please enter it in Settings.');

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model ?? getLlmModel(),
      messages,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Seed LLM error (${res.status}): ${JSON.stringify(data)}`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Seed LLM returned empty response');
  return text;
}

// ─── Frame extraction (browser canvas — unchanged from geminiService) ─────────

export const extractFrames = async (videoFile: File, numFrames = 5): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Video loading timeout (30s).'));
    }, 30000);

    video.onloadeddata = async () => {
      clearTimeout(timeout);
      const duration = video.duration;
      const interval = duration / (numFrames + 1);
      const frames: string[] = [];
      const canvas = document.createElement('canvas');
      const maxDim = 512;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 360;
      const ratio = width / height;
      if (width > height) { width = maxDim; height = maxDim / ratio; }
      else { height = maxDim; width = maxDim * ratio; }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      try {
        for (let i = 1; i <= numFrames; i++) {
          video.currentTime = interval * i;
          await new Promise(r => {
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(null); };
            video.addEventListener('seeked', onSeeked);
            setTimeout(onSeeked, 2000);
          });
          ctx?.drawImage(video, 0, 0, width, height);
          frames.push(canvas.toDataURL('image/jpeg', 0.4).split(',')[1]);
        }
        URL.revokeObjectURL(videoUrl);
        resolve(frames);
      } catch (e) { URL.revokeObjectURL(videoUrl); reject(e); }
    };

    video.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(video.src); reject(new Error('Failed to load video file.')); };
  });
};

// ─── Analyze video scenes (multimodal: images → Seed 2.0) ────────────────────

export const analyzeVideoScenes = async (
  framesBase64: string[],
  targetSceneCount = 5,
  language: 'en' | 'vi' | 'none' = 'en',
) => {
  const langInstruction = language === 'vi'
    ? 'Write the narration in Vietnamese.'
    : language === 'none'
    ? 'Leave the narration field as an empty string "".'
    : 'Write the narration in English.';

  // Build multimodal message — Seed 2.0 supports image_url in content array
  const content: object[] = framesBase64.map(f => ({
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${f}` },
  }));
  content.push({
    type: 'text',
    text: `Analyze these sequential frames from a video. Break the video down into exactly ${targetSceneCount} distinct scenes.
For each scene describe:
- action: exactly what is happening
- characters: who is on screen
- setting: the environment
- mood: the visual tone
- narration: a short voiceover line spoken by a narrator for this scene (1-2 sentences). ${langInstruction}

Return ONLY a JSON array of ${targetSceneCount} objects.
Format: [{"sceneNumber": 1, "action": "...", "characters": "...", "setting": "...", "mood": "...", "narration": "..."}, ...]`,
  });

  const raw = await seedChat([{ role: 'user', content }]);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : extractJson(raw));
  return Array.isArray(parsed) ? parsed : [parsed];
};

// ─── Generate auto script from idea ──────────────────────────────────────────

export const generateAutoScript = async (
  idea: string,
  style: string,
  sceneCount: number,
  language: 'en' | 'vi' | 'none' = 'en',
) => {
  const langInstruction = language === 'vi' ? 'Write the narration in Vietnamese.'
    : language === 'none' ? 'Leave the narration field empty.'
    : 'Write the narration in English.';

  const prompt = `You are an expert AI video director. The user wants to create a video based on this idea: "${idea}".
The visual style should be: "${style}".
Create a detailed script with exactly ${sceneCount} scenes.
${langInstruction}

Respond ONLY with a valid JSON object in this exact format:
{
  "characters": [{"name": "Character Name", "description": "Visual description"}],
  "settings": [{"name": "Setting Name", "description": "Visual description"}],
  "scenes": [
    {
      "sceneNumber": 1,
      "action": "Brief description of what happens",
      "prompt": "Highly detailed English prompt for an AI video generator. Include camera angle, lighting, character appearance, action, and the specific visual style (${style}).",
      "narration": "The voiceover text for this scene (in the requested language). Keep it short and engaging."
    }
  ]
}`;

  const raw = await seedChat([{ role: 'user', content: prompt }]);
  return JSON.parse(extractJson(raw));
};

// ─── Generate script from video frames ───────────────────────────────────────

export const generateScriptFromVideo = async (
  framesBase64: string[],
  style: string,
  sceneCount: number,
  language: 'en' | 'vi' | 'none' = 'en',
) => {
  const langInstruction = language === 'vi' ? 'Write the narration in Vietnamese.'
    : language === 'none' ? 'Leave the narration field empty.'
    : 'Write the narration in English.';

  const content: object[] = framesBase64.map(f => ({
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${f}` },
  }));
  content.push({
    type: 'text',
    text: `You are an expert AI video director. Analyze these sequential frames from a video.
The user wants to recreate this video with a new visual style: "${style}".
Create a detailed script with exactly ${sceneCount} scenes based on the flow of the input video.
${langInstruction}

Respond ONLY with a valid JSON object in this exact format:
{
  "characters": [{"name": "Character Name", "description": "Visual description in the new style"}],
  "settings": [{"name": "Setting Name", "description": "Visual description in the new style"}],
  "scenes": [
    {
      "sceneNumber": 1,
      "action": "Brief description of what happens",
      "prompt": "Highly detailed English prompt for an AI video generator. Include camera angle, lighting, character appearance, action, and the specific visual style (${style}).",
      "narration": "The voiceover text for this scene (in the requested language). Keep it short and engaging."
    }
  ]
}`,
  });

  const raw = await seedChat([{ role: 'user', content }]);
  return JSON.parse(extractJson(raw));
};

// ─── Improve scene prompt ─────────────────────────────────────────────────────

export const improveScenePrompt = async (currentAction: string, currentMood: string, style: string) => {
  const prompt = `You are a creative video prompt engineer.
Rewrite and improve this scene description to be more cinematic and vivid, keeping the same core action but making it more descriptive for an AI video generator.
Current Action: "${currentAction}"
Current Mood/Atmosphere: "${currentMood}"
Target Visual Style: "${style}"

Respond ONLY with a valid JSON object:
{"action": "improved descriptive action", "mood": "improved descriptive mood/atmosphere"}`;

  const raw = await seedChat([{ role: 'user', content: prompt }]);
  return JSON.parse(extractJson(raw));
};

// ─── Regenerate all prompts (character consistency) ───────────────────────────

export const regeneratePromptsFromCharacters = async (
  scriptData: {
    characters: { name: string; description: string }[];
    settings: { name: string; description: string }[];
    scenes: { sceneNumber: number; action: string; prompt: string; narration?: string }[];
  },
  style: string,
): Promise<{ sceneNumber: number; prompt: string }[]> => {
  const charList = scriptData.characters.map(c => `- ${c.name}: ${c.description}`).join('\n');
  const settingList = scriptData.settings.map(s => `- ${s.name}: ${s.description}`).join('\n');
  const sceneList = scriptData.scenes.map(s => `Scene ${s.sceneNumber}: ${s.action}`).join('\n');

  const prompt = `You are an expert AI video director. Rewrite ALL scene video prompts to be fully consistent with these updated descriptions.

UPDATED CHARACTERS:\n${charList}
UPDATED SETTINGS:\n${settingList}
VISUAL STYLE: ${style}
SCENES TO REWRITE (keep the same action, only rewrite the video prompt):\n${sceneList}

Rules:
- Every prompt must reference the character's EXACT visual appearance from the updated descriptions
- Maintain consistent character appearance across all scenes
- Each prompt should be highly detailed: camera angle, lighting, character clothing/features, action

Respond ONLY with a valid JSON array:
[{"sceneNumber": 1, "prompt": "detailed prompt..."}, ...]`;

  const raw = await seedChat([{ role: 'user', content: prompt }]);
  return JSON.parse(extractJson(raw));
};

// ─── Image generation (Seedream) ─────────────────────────────────────────────

export const generateImage = async (
  prompt: string,
  aspectRatio = '1:1',
  _imageSize = '1K',
  _modelName = 'seedream-5-0-260128',
) => {
  const apiKey = getArkApiKey();
  if (!apiKey) throw new Error('ARK API Key missing. Please enter it in Settings.');

  const res = await fetch(IMAGE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'seedream-5-0-260128',
      prompt,
      size: aspectRatio === '9:16' ? '1024x1792' : aspectRatio === '16:9' ? '1792x1024' : '1024x1024',
      response_format: 'url',
      watermark: false,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Seedream image error (${res.status}): ${JSON.stringify(data)}`);

  const imageUrl: string = data.data?.[0]?.url;
  if (!imageUrl) throw new Error('Seedream returned no image URL');

  // Download → data URL for display
  const imgRes = await fetch(imageUrl);
  const blob = await imgRes.blob();
  const reader = new FileReader();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  saveToStudioGallery({ type: 'image', url: dataUrl, prompt, settings: { model: 'seedream-5-0-260128', aspectRatio } });
  return dataUrl;
};

// ─── Stub: generateSpeech (Seed 2.0 has no TTS — use silent fallback) ────────
export const generateSpeech = async (_text: string, _language: 'en' | 'vi'): Promise<string> => {
  throw new Error('Text-to-speech is not available on ByteDance edition. Narration is embedded natively in Seedance video generation.');
};
