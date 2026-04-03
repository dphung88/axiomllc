/**
 * Provider-aware video service router.
 * Reads `provider` from localStorage and delegates to the right backend.
 */
import * as veo from './veoService';
import * as seedance from './bytedanceVideoService';

function getProvider(): 'google' | 'bytedance' {
  try {
    const saved = localStorage.getItem('studioSettings');
    if (saved) return JSON.parse(saved).provider ?? 'google';
  } catch {}
  return 'google';
}

export function generateVideo(
  ...args: Parameters<typeof veo.generateVideo>
): ReturnType<typeof veo.generateVideo> {
  if (getProvider() === 'bytedance') {
    return seedance.generateVideo(...args);
  }
  return veo.generateVideo(...args);
}

export function pollVideoOperation(
  ...args: Parameters<typeof veo.pollVideoOperation>
): ReturnType<typeof veo.pollVideoOperation> {
  if (getProvider() === 'bytedance') {
    return seedance.pollVideoOperation(...args);
  }
  return veo.pollVideoOperation(...args);
}
