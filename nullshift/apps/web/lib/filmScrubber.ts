/** Request real encoded frames, never fractional duplicates or an unbounded seek queue. */
export function quantizedVideoTime(seconds: number, duration: number, fps: number) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0)
    return 0;
  const lastFrame = Math.max(0, Math.ceil(duration * fps - 0.000001) - 1);
  const frame = Math.min(
    lastFrame,
    Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * fps))
  );
  return frame / fps;
}

export function createFilmScrubber(
  video: HTMLVideoElement,
  { fps, canSeek }: { fps: number; canSeek: () => boolean }
) {
  let wantedTime: number | null = null;
  let lastRequestedFrame: number | null = null;
  let disposed = false;

  const flush = () => {
    if (
      disposed ||
      wantedTime === null ||
      !canSeek() ||
      video.seeking ||
      video.readyState < 2 ||
      !Number.isFinite(video.duration)
    )
      return;
    const time = quantizedVideoTime(wantedTime, video.duration, fps);
    const frame = Math.round(time * fps);
    if (lastRequestedFrame === frame) return;
    lastRequestedFrame = frame;
    if (Math.abs(video.currentTime - time) > 0.001) video.currentTime = time;
  };
  const reset = () => {
    wantedTime = null;
    lastRequestedFrame = null;
  };
  video.addEventListener("loadeddata", flush);
  video.addEventListener("seeked", flush);
  return {
    request(seconds: number) {
      wantedTime = seconds;
      flush();
    },
    flush,
    reset,
    destroy() {
      disposed = true;
      reset();
      video.removeEventListener("loadeddata", flush);
      video.removeEventListener("seeked", flush);
    },
  };
}

/** Comparing first avoids repeated style invalidations when a cue holds its state. */
export function setFilmStyle(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value)
    element.style.setProperty(property, value);
}
