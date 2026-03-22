import { GoogleGenAI } from '@google/genai';
import { getApiKey, getLlmModel } from './apiConfig';
import { saveToStudioGallery } from './supabase';

/** Strip markdown code fences and extract the first JSON object or array */
function extractJson(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Try to find object {...}
  const objStart = s.indexOf('{');
  const objEnd = s.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1) return s.substring(objStart, objEnd + 1);
  // Fallback: try array [...]
  const arrStart = s.indexOf('[');
  const arrEnd = s.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1) return s.substring(arrStart, arrEnd + 1);
  return s;
}

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

  // TTS requires a model with AUDIO output support — hardcode to avoid user picking incompatible model
  const ttsModel = 'gemini-2.5-flash-preview-tts';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const voiceName = language === 'vi' ? 'Puck' : 'Kore';

    const response = await ai.models.generateContent({
      model: ttsModel,
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
    const videoUrl = URL.createObjectURL(videoFile);
    
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    // Force preload
    video.preload = 'auto';
    
    // Set a timeout to prevent infinite loading if video fails
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Video loading timeout (30s). The file might be too large, corrupted, or in an unsupported format.'));
    }, 30000);

    video.onloadedmetadata = () => {
       // Ensure we have dimensions
       if (video.videoWidth === 0 || video.videoHeight === 0) {
         console.warn('Video dimensions not found in metadata, waiting for loadeddata');
       }
    };

    video.onloadeddata = async () => {
      clearTimeout(timeout);
      const duration = video.duration;
      const interval = duration / (numFrames + 1);
      const frames: string[] = [];
      const canvas = document.createElement('canvas');
      
      // Lower resolution significantly for Gemini analysis to ensure we don't hit payload limits
      // Gemini 1.5 doesn't need high res to understand scenes
      const maxDim = 512; 
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 360;
      
      const ratio = width / height;
      if (width > height) {
        width = maxDim;
        height = maxDim / ratio;
      } else {
        height = maxDim;
        width = maxDim * ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      try {
        for (let i = 1; i <= numFrames; i++) {
          video.currentTime = interval * i;
          await new Promise(r => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              r(null);
            };
            video.addEventListener('seeked', onSeeked);
            // Fallback for seeking
            setTimeout(onSeeked, 2000);
          });
          
          ctx?.drawImage(video, 0, 0, width, height);
          // Use even lower quality (0.4) for analysis frames to save bandwidth
          const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
          frames.push(dataUrl.split(',')[1]);
        }
        URL.revokeObjectURL(videoUrl);
        resolve(frames);
      } catch (e) {
        URL.revokeObjectURL(videoUrl);
        reject(e);
      }
    };
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video file.'));
    };
  });
};

export const analyzeVideoScenes = async (framesBase64: string[], targetSceneCount: number = 5) => {
  const apiKey = getApiKey();
  const model = getLlmModel();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const imageParts = framesBase64.map(f => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: f
    }
  }));
  
  const prompt = `Analyze these sequential frames from a video. Break the video down into exactly ${targetSceneCount} distinct scenes.
For each scene, describe:
- action: exactly what is happening
- characters: who is on screen
- setting: the environment
- mood: the visual tone

Return ONLY a JSON array of ${targetSceneCount} objects. 
Format: [{"sceneNumber": 1, "action": "...", "characters": "...", "setting": "...", "mood": "..."}, ...]`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }]
    });
    
    let jsonResult = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text);
    
    if (!jsonResult) {
      throw new Error("Empty response from AI. Please try a different video.");
    }

    const cleanJson = (text: string) => {
      // Improved JSON extraction using regex
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) return jsonMatch[0];
      
      let s = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const start = s.indexOf("[");
      const end = s.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        return s.substring(start, end + 1);
      }
      return s;
    };

    try {
      const parsed = JSON.parse(cleanJson(jsonResult));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseError) {
      console.error("JSON Parse Error. Raw result:", jsonResult);
      throw new Error("Failed to parse video analysis result. The AI response was not in the correct format.");
    }
  } catch (error: any) {
    console.error("Gemini Video Analysis Error:", error);
    if (error?.message?.includes('413') || error?.message?.includes('large')) {
      throw new Error("Video payload too large. Try reducing the number of scenes or use a shorter video.");
    }
    throw error;
  }
};

export const generateAutoScript = async (idea: string, style: string, sceneCount: number, language: 'en' | 'vi' | 'none' = 'en') => {
  const apiKey = getApiKey();
  const model = getLlmModel();
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
      "prompt": "Highly detailed English prompt for an AI video generator. Include camera angle, lighting, character appearance, action, and the specific visual style (${style}).",
      "narration": "The voiceover text for this scene (in the requested language). Keep it short and engaging."
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt
    });
    
    const rawText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '{}';
    return JSON.parse(extractJson(rawText));
  } catch (error) {
    console.error("AutoScript Error:", error);
    throw error;
  }
};

export const generateScriptFromVideo = async (framesBase64: string[], style: string, sceneCount: number, language: 'en' | 'vi' | 'none' = 'en') => {
  const apiKey = getApiKey();
  const model = getLlmModel();
  if (!apiKey) throw new Error('API Key is missing. Please select or enter an API key in Settings.');
  
  const ai = new GoogleGenAI({ apiKey });
  
  const imageParts = framesBase64.map(f => ({
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

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }]
    });
    
    const rawText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '{}';
    return JSON.parse(extractJson(rawText));
  } catch (error) {
    console.error("ScriptFromVideo Error:", error);
    throw error;
  }
};

export const improveScenePrompt = async (currentAction: string, currentMood: string, style: string) => {
  const apiKey = getApiKey();
  const model = getLlmModel();
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
      model: model,
      contents: prompt
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
      const url = `data:image/png;base64,${base64EncodeString}`;
      
      // Centralized auto-save for Direct Image Gen service
      saveToStudioGallery({
        type: 'image',
        url,
        prompt,
        settings: { model: modelName, size: imageSize, aspectRatio }
      });

      return url;
    }
  }
  throw new Error('No image data in response');
};
