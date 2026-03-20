import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiConfig';

export const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  return new GoogleGenAI({ apiKey });
};

export const generateVideo = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  lastFrame?: { data: string; mimeType: string },
  aspectRatio: '16:9' | '9:16' = '16:9',
  resolution: '720p' | '1080p' = '720p',
  model: string = 'veo-2.0-generate-001'
) => {
  const ai = getAiClient();
  
  // For Free Tier, 720p is safer and more likely to succeed
  const config: any = {
    numberOfVideos: 1,
    resolution: resolution === '1080p' ? '720p' : resolution,
    aspectRatio,
  };

  if (lastFrame) {
    config.lastFrame = {
      imageBytes: lastFrame.data,
      mimeType: lastFrame.mimeType,
    };
  }

  const req: any = {
    model,
    prompt,
    config,
  };

  if (image) {
    req.image = {
      imageBytes: image.data,
      mimeType: image.mimeType,
    };
  }

  const result = await ai.models.generateVideos(req);
  return result;
};

export const pollVideoOperation = async (result: any, onProgress?: (msg: string) => void) => {
  const ai = getAiClient();
  let currentResult = result;
  const startTime = Date.now();
  const timeoutMs = 10 * 60 * 1000; // 10 minutes
  
  while (!currentResult.done) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Video generation timed out after 10 minutes.');
    }
    if (onProgress) onProgress('Generating video... this may take a few minutes.');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
    currentResult = await ai.operations.getVideosOperation({ operation: currentResult });
  }
  
  const downloadLink = currentResult.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error('Video generation failed or returned no URI.');
  }
  
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
