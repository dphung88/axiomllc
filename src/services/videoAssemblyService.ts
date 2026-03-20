export const concatVideos = async (
  scenes: { videoUrl: string; audioUrl?: string }[],
  onProgress?: (p: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      if (!scenes || scenes.length === 0) {
        reject(new Error('No videos to concatenate'));
        return;
      }

      const video = document.createElement('video');
      // Do NOT set crossOrigin — blob: URLs are same-origin and crossOrigin breaks them
      video.muted = true; // Keep muted to satisfy autoplay policy
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not supported'));
        return;
      }

      let currentIdx = 0;
      const chunks: Blob[] = [];
      let recorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let animationFrameId: number | null = null;
      let isRecording = false;

      const drawFrame = () => {
        if (isRecording && !video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      const cleanup = () => {
        try {
          isRecording = false;
          if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
          if (recorder && recorder.state !== 'inactive') recorder.stop();
          if (stream) stream.getTracks().forEach(t => t.stop());
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
          video.src = scenes[currentIdx].videoUrl;
          video.play().catch(e => {
            cleanup();
            reject(new Error(`Failed to play video ${currentIdx + 1}: ${e.message}`));
          });
        } else {
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
            stream = canvas.captureStream ? canvas.captureStream(30) : canvas.mozCaptureStream(30);
            if (!stream) {
              cleanup();
              reject(new Error('captureStream not supported in this browser'));
              return;
            }

            const mimeTypes = [
              'video/mp4',
              'video/webm;codecs=h264,opus',
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp8,opus',
              'video/webm',
            ];

            let options: MediaRecorderOptions = {};
            for (const mimeType of mimeTypes) {
              if (MediaRecorder.isTypeSupported(mimeType)) {
                options = { mimeType, videoBitsPerSecond: 8_000_000 };
                console.log('[Assembly] Selected MIME type:', mimeType);
                break;
              }
            }

            recorder = new MediaRecorder(stream, options);

            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/webm' });
              cleanup();
              resolve(URL.createObjectURL(blob));
            };

            recorder.start(100);
            isRecording = true;
            drawFrame();
          } catch (e: any) {
            cleanup();
            reject(new Error(`Failed to start recording: ${e.message}`));
          }
        }
      };

      video.onerror = () => {
        const code = video.error?.code ?? '?';
        const msg = video.error?.message || '';
        // MediaError codes: 1=ABORTED 2=NETWORK 3=DECODE 4=SRC_NOT_SUPPORTED
        const detail = `code=${code}${msg ? ' ' + msg : ''}`;
        cleanup();
        reject(new Error(`Error loading video ${currentIdx + 1}: ${detail}`));
      };

      // Load and play the first scene (muted → autoplay allowed)
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
