import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

const loadFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpegBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm';
    await ffmpeg.load({
      classWorkerURL: await toBlobURL(`${ffmpegBase}/worker.js`, 'text/javascript'),
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffmpeg;
    ffmpegLoadPromise = null;
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
};

export const concatVideos = async (
  scenes: { videoUrl: string; audioUrl?: string; subtitle?: string }[],
  onProgress?: (p: number) => void,
  showSubtitles = false
): Promise<string> => {
  if (!scenes || scenes.length === 0) throw new Error('No videos to concatenate');

  // Report loading stage
  onProgress?.(0.01);

  const ffmpeg = await loadFFmpeg();
  onProgress?.(0.05);

  const totalScenes = scenes.length;
  let step = 0;
  const tickProgress = () => {
    step++;
    // Steps: download each video (1 per scene) + process each scene (1 per scene) + concat + read = totalScenes*2 + 2
    onProgress?.(0.05 + (step / (totalScenes * 2 + 2)) * 0.9);
  };

  const processedFiles: string[] = [];

  try {
    for (let i = 0; i < scenes.length; i++) {
      // Download and write video
      const videoData = await fetchFile(scenes[i].videoUrl);
      await ffmpeg.writeFile(`inv${i}`, videoData);
      tickProgress();

      const outFile = `sc${i}.mp4`;

      if (scenes[i].audioUrl) {
        // Mix video with narration audio
        const audioData = await fetchFile(scenes[i].audioUrl);
        await ffmpeg.writeFile(`ina${i}`, audioData);

        await ffmpeg.exec([
          '-i', `inv${i}`,
          '-i', `ina${i}`,
          '-c:v', 'copy',
          '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
          '-map', '0:v:0', '-map', '1:a:0',
          '-shortest',
          outFile
        ]);
        await ffmpeg.deleteFile(`ina${i}`).catch(() => {});
      } else {
        // No separate narration: re-encode embedded audio to AAC for concat compatibility
        await ffmpeg.exec([
          '-i', `inv${i}`,
          '-c:v', 'copy',
          '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
          outFile
        ]);
      }

      await ffmpeg.deleteFile(`inv${i}`).catch(() => {});
      processedFiles.push(outFile);
      tickProgress();
    }

    // Create concat list
    const concatList = processedFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));

    // Concatenate all scenes
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
      '-c', 'copy',
      'output.mp4'
    ]);
    tickProgress();

    // Read output blob
    const outputData = await ffmpeg.readFile('output.mp4') as Uint8Array;
    const blob = new Blob([outputData], { type: 'video/mp4' });

    // Cleanup
    for (const f of processedFiles) await ffmpeg.deleteFile(f).catch(() => {});
    await ffmpeg.deleteFile('concat.txt').catch(() => {});
    await ffmpeg.deleteFile('output.mp4').catch(() => {});

    tickProgress();
    onProgress?.(1);

    return URL.createObjectURL(blob);
  } catch (err: any) {
    // Cleanup on failure
    for (let i = 0; i < scenes.length; i++) {
      await ffmpeg.deleteFile(`inv${i}`).catch(() => {});
      await ffmpeg.deleteFile(`ina${i}`).catch(() => {});
      await ffmpeg.deleteFile(`sc${i}.mp4`).catch(() => {});
    }
    await ffmpeg.deleteFile('concat.txt').catch(() => {});
    await ffmpeg.deleteFile('output.mp4').catch(() => {});

    throw new Error(`Assembly failed: ${err.message || err}`);
  }
};
