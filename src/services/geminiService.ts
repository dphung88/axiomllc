import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiConfig';

function createWavFile(base64Data: string): string {
  try {
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Check if it already has a RIFF header
    if (bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70) {
       const blob = new Blob([bytes], { type: 'audio/wav' });
       return URL.createObjectURL(blob);
    }
    
    // If it's raw PCM, add a WAV header
    const buffer = new ArrayBuffer(44 + bytes.length);
    const view = new DataView(buffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + bytes.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, 24000, true); // Sample rate
    view.setUint32(28, 24000 * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, bytes.length, true);
    
    const pcmData = new Uint8Array(buffer, 44);
    pcmData.set(bytes);
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Error creating WAV file:', e);
    throw new Error('Failed to process audio data');
  }
}

export const generateSpeech = async (text: string, language: 'en' | 'vi') => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const voiceName = language === 'vi' ? 'Puck' : 'Kore';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('No audio data returned from Gemini');
    
    return createWavFile(base64Audio);
  } catch (error: any) {
    console.error('Speech generation error:', error);
    let message = error?.message || 'Failed to generate speech';
    try {
      // Try to parse JSON error if it's a stringified JSON
      if (typeof message === 'string' && message.includes('{')) {
        const json = JSON.parse(message.substring(message.indexOf('{')));
        if (json.error?.message) message = json.error.message;
      }
    } catch (e) {}
    throw new Error(message);
  }
};

export const extractFrames = async (videoFile: File, numFrames: number = 5): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.crossOrigin = 'anonymous';
    
    video.onloadeddata = async () => {
      const duration = video.duration;
      const interval = duration / (numFrames + 1);
      const frames: string[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      for (let i = 1; i <= numFrames; i++) {
        video.currentTime = interval * i;
        await new Promise(r => {
          video.onseeked = r;
        });
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        frames.push(dataUrl.split(',')[1]);
      }
      URL.revokeObjectURL(video.src);
      resolve(frames);
    };
    video.onerror = reject;
  });
};

export const analyzeVideoScenes = async (framesBase64: string[], targetSceneCount: number = 5) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const parts = framesBase64.map(f => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: f
    }
  }));
  
  const prompt = `Analyze these sequential frames from a video. Break the video down into exactly ${targetSceneCount} distinct scenes based on the flow of the video.
For each scene, provide:
1. Action taking place
2. Characters present
3. Setting/Environment
4. Mood/Atmosphere

Return the result as a JSON array of exactly ${targetSceneCount} objects with keys: "sceneNumber", "action", "characters", "setting", "mood".
Respond with valid JSON only. Do not include markdown formatting or extra text.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [...parts, { text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    let jsonResult = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '[]';
    
    console.log("Raw Gemini Response:", jsonResult);

    // Clean JSON if it's wrapped in markdown backticks
    if (jsonResult.includes('```json')) {
      jsonResult = jsonResult.split('```json')[1].split('```')[0].trim();
    } else if (jsonResult.includes('```')) {
      const split = jsonResult.split('```');
      jsonResult = split[1] || split[0];
      jsonResult = jsonResult.split('```')[0].trim();
    }

    // Secondary cleanup: remove any leading/trailing text outside brackets
    const startBracket = jsonResult.indexOf('[');
    const endBracket = jsonResult.lastIndexOf(']');
    if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
      jsonResult = jsonResult.substring(startBracket, endBracket + 1);
    }

    const parsed = JSON.parse(jsonResult);
    if (!Array.isArray(parsed)) {
      throw new Error("Gemini did not return a JSON array");
    }
    return parsed;
  } catch (error: any) {
    console.error("Video Analysis Detailed Error:", error);
    throw error;
  }
};

export const generateAutoScript = async (idea: string, style: string, sceneCount: number, language: 'en' | 'vi' | 'none' = 'en') => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const langInstruction = language === 'vi' ? 'Write the narration in Vietnamese.' : language === 'en' ? 'Write the narration in English.' : 'Leave the narration empty.';
  
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
      "prompt": "Highly detailed English prompt for an AI video generator (like Veo or Sora). Include camera angle, lighting, character appearance, action, and the specific visual style (${style}).",
      "narration": "The voiceover text for this scene (in the requested language). Keep it short and engaging."
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-pro',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    }
  });
  
  const jsonResult = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '{}';
  return JSON.parse(jsonResult as string);
};

export const generateScriptFromVideo = async (framesBase64: string[], style: string, sceneCount: number, language: 'en' | 'vi' | 'none' = 'en') => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const parts = framesBase64.map(f => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: f
    }
  }));
  
  const langInstruction = language === 'vi' ? 'Write the narration in Vietnamese.' : language === 'en' ? 'Write the narration in English.' : 'Leave the narration empty.';
  
  const prompt = `You are an expert AI video director. Analyze these sequential frames from a video.
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
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-pro',
    contents: [{ role: 'user', parts: [...parts, { text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
    }
  });
  
  const jsonResult = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '{}';
  return JSON.parse(jsonResult as string);
};

export const improveScenePrompt = async (currentAction: string, currentMood: string, style: string) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are a creative video prompt engineer. 
    Rewrite and improve this scene description to be more cinematic and vivid, keeping the same core action but making it more descriptive for an AI video generator.
    Current Action: "${currentAction}"
    Current Mood/Atmosphere: "${currentMood}"
    Target Visual Style: "${style}"

    Respond ONLY with a valid JSON object:
    {
      "action": "improved descriptive action",
      "mood": "improved descriptive mood/atmosphere"
    }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    const jsonResult = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '{}';
    return JSON.parse(jsonResult as string);
  } catch (error) {
    console.error("Reprompt failed:", error);
    throw error;
  }
};

export const generateImage = async (prompt: string, aspectRatio: string = "1:1", imageSize: string = "1K", modelName: string = 'imagen-3.0-generate-001') => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
    }
  });
  
  const parts = response.candidates?.[0]?.content?.parts;
  
  if (!parts) {
    throw new Error('No response from Gemini');
  }

  for (const part of parts) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  throw new Error('No image data in response');
};
