const drawSubtitle = (ctx: CanvasRenderingContext2D, text: string, canvasWidth: number, canvasHeight: number) => {
  const padding = 12;
  const maxWidth = canvasWidth - padding * 4;
  const fontSize = Math.max(16, Math.round(canvasHeight * 0.042));
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  // Word-wrap
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = fontSize * 1.35;
  const blockHeight = lines.length * lineHeight + padding * 2;
  const blockY = canvasHeight - blockHeight - Math.round(canvasHeight * 0.04);

  // Semi-transparent background
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const bgX = padding;
  const bgW = canvasWidth - padding * 2;
  ctx.beginPath();
  // @ts-ignore
  if (ctx.roundRect) {
    // @ts-ignore
    ctx.roundRect(bgX, blockY, bgW, blockHeight, 8);
  } else {
    ctx.rect(bgX, blockY, bgW, blockHeight);
  }
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  lines.forEach((l, i) => {
    ctx.fillText(l, canvasWidth / 2, blockY + padding + i * lineHeight);
  });
  ctx.shadowBlur = 0;
};

export const concatVideos = async (
  scenes: { videoUrl: string; audioUrl?: string; subtitle?: string }[],
  onProgress?: (p: number) => void,
  showSubtitles = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      if (!scenes || scenes.length === 0) {
        reject(new Error('No videos to concatenate'));
        return;
      }

      // --- Video element for canvas capture (visual only) ---
      const video = document.createElement('video');
      video.muted = true; // muted so canvas renders correctly; audio captured separately
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not supported'));
        return;
      }

      // --- Web Audio API for TTS narration tracks ---
      let audioCtx: AudioContext | null = null;
      let audioDestination: MediaStreamAudioDestinationNode | null = null;
      let currentNarrationAudio: HTMLAudioElement | null = null;
      let currentNarrationSource: MediaElementAudioSourceNode | null = null;

      try {
        audioCtx = new AudioContext();
        audioDestination = audioCtx.createMediaStreamDestination();
        console.log('[Assembly] Web Audio API ready for narration mixing');
      } catch (e) {
        console.warn('[Assembly] Web Audio API unavailable, narration will be skipped:', e);
      }

      const playNarration = (audioUrl: string | undefined) => {
        // Stop & disconnect previous narration
        try {
          if (currentNarrationSource) { currentNarrationSource.disconnect(); currentNarrationSource = null; }
          if (currentNarrationAudio) { currentNarrationAudio.pause(); currentNarrationAudio = null; }
        } catch (_) {}

        if (!audioUrl || !audioCtx || !audioDestination) return;

        try {
          currentNarrationAudio = new Audio(audioUrl);
          currentNarrationAudio.crossOrigin = 'anonymous';
          currentNarrationSource = audioCtx.createMediaElementSource(currentNarrationAudio);
          // Route narration to destination (captured in stream) — NOT to speakers
          currentNarrationSource.connect(audioDestination);
          currentNarrationAudio.play().catch(e =>
            console.warn('[Assembly] Narration play failed:', e)
          );
        } catch (e) {
          console.warn('[Assembly] Narration setup failed:', e);
        }
      };

      let currentIdx = 0;
      const chunks: Blob[] = [];
      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let animationFrameId: number | null = null;
      let isRecording = false;

      const drawFrame = () => {
        if (isRecording && !video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (showSubtitles) {
            const sub = scenes[currentIdx]?.subtitle;
            if (sub) drawSubtitle(ctx, sub, canvas.width, canvas.height);
          }
        }
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      const cleanup = () => {
        try {
          isRecording = false;
          if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
          if (recorder && recorder.state !== 'inactive') recorder.stop();
          if (stream) stream.getTracks().forEach(t => t.stop());
          if (currentNarrationSource) currentNarrationSource.disconnect();
          if (currentNarrationAudio) { currentNarrationAudio.pause(); currentNarrationAudio = null; }
          if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
          video.pause();
          video.removeAttribute('src');
          video.load();
          if (video.parentNode) video.parentNode.removeChild(video);
        } catch (e) {
          console.error('Cleanup error', e);
        }
      };

      video.onended = () => {
        currentIdx++;
        if (onProgress) onProgress(currentIdx / scenes.length);

        if (currentIdx < scenes.length) {
          // Load next scene video + start its narration
          playNarration(scenes[currentIdx].audioUrl);
          video.src = scenes[currentIdx].videoUrl;
          video.play().catch(e => {
            cleanup();
            reject(new Error(`Failed to play video ${currentIdx + 1}: ${e.message}`));
          });
        } else {
          // All scenes done
          playNarration(undefined); // stop narration
          isRecording = false;
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          } else {
            cleanup();
            resolve('');
          }
        }
      };

      video.onloadedmetadata = () => {
        if (!recorder) {
          try {
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;

            // @ts-ignore
            const canvasStream: MediaStream = canvas.captureStream
              // @ts-ignore
              ? canvas.captureStream(30)
              // @ts-ignore
              : canvas.mozCaptureStream(30);

            if (!canvasStream) {
              cleanup();
              reject(new Error('captureStream not supported in this browser'));
              return;
            }

            // Build combined stream: video (canvas) + audio (narration if available)
            const tracks = [...canvasStream.getVideoTracks()];
            if (audioDestination && audioDestination.stream.getAudioTracks().length > 0) {
              tracks.push(...audioDestination.stream.getAudioTracks());
              console.log('[Assembly] Narration audio track added to recording');
            }
            stream = new MediaStream(tracks);

            const mimeTypes = [
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp8,opus',
              'video/webm;codecs=h264,opus',
              'video/webm',
              'video/mp4',
            ];

            let options: MediaRecorderOptions = {};
            for (const mimeType of mimeTypes) {
              if (MediaRecorder.isTypeSupported(mimeType)) {
                options = { mimeType, videoBitsPerSecond: 8_000_000 };
                console.log('[Assembly] MIME type:', mimeType);
                break;
              }
            }

            recorder = new MediaRecorder(stream, options);
            recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/webm' });
              cleanup();
              resolve(URL.createObjectURL(blob));
            };

            // Resume AudioContext if suspended (browser autoplay policy)
            if (audioCtx?.state === 'suspended') audioCtx.resume().catch(console.warn);

            recorder.start(100);
            isRecording = true;
            drawFrame();

            // Start first scene narration
            playNarration(scenes[0].audioUrl);
          } catch (e: any) {
            cleanup();
            reject(new Error(`Failed to start recording: ${e.message}`));
          }
        }
      };

      video.onerror = () => {
        const code = video.error?.code ?? '?';
        const msg = video.error?.message || '';
        const detail = `code=${code}${msg ? ' ' + msg : ''}`;
        cleanup();
        reject(new Error(`Error loading video ${currentIdx + 1}: ${detail}`));
      };

      // Start first scene
      video.src = scenes[0].videoUrl;
      video.play().catch(e => {
        cleanup();
        reject(new Error(`Failed to play first video: ${e.message}`));
      });

    } catch (err: any) {
      reject(new Error(`Assembly failed: ${err.message}`));
    }
  });
};
