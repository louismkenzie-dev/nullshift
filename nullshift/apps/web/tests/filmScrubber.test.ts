import { describe, expect, it } from "vitest";
import { createFilmScrubber, quantizedVideoTime } from "@/lib/filmScrubber";

function fakeVideo() {
  let currentTime = 0;
  const requests: number[] = [];
  const element = Object.assign(new EventTarget(), {
    duration: 16,
    readyState: 2,
    seeking: false,
    get currentTime() {
      return currentTime;
    },
  });
  Object.defineProperty(element, "currentTime", {
    get: () => currentTime,
    set: (time: number) => {
      currentTime = time;
      requests.push(time);
      element.seeking = true;
    },
  });
  return { element: element as unknown as HTMLVideoElement, requests };
}

const completeSeek = (element: HTMLVideoElement) =>
  Object.defineProperty(element, "seeking", { value: false, writable: true });

describe("frame-quantized, latest-target film seeking", () => {
  it("clamps to actual frame indices, including the last frame", () => {
    expect(quantizedVideoTime(1.001, 16, 24)).toBe(1);
    expect(quantizedVideoTime(1.015, 16, 24)).toBe(1);
    expect(quantizedVideoTime(30, 16, 24)).toBe(383 / 24);
    expect(quantizedVideoTime(-2, 16, 24)).toBe(0);
    expect(quantizedVideoTime(NaN, 16, 24)).toBe(0);
    expect(quantizedVideoTime(5, NaN, 24)).toBe(0);
    expect(quantizedVideoTime(5, 16, 0)).toBe(0);
  });
  it("keeps only the newest target while a seek is outstanding, in either direction", () => {
    const { element, requests } = fakeVideo();
    const scrub = createFilmScrubber(element, { fps: 24, canSeek: () => true });
    scrub.request(2);
    scrub.request(3);
    scrub.request(4);
    expect(requests).toEqual([2]);
    completeSeek(element);
    element.dispatchEvent(new Event("seeked"));
    expect(requests).toEqual([2, 4]);
    completeSeek(element);
    scrub.request(4.01);
    expect(requests).toHaveLength(2);
    scrub.request(1);
    expect(requests).toEqual([2, 4, 1]);
    scrub.destroy();
  });
  it("does not seek offscreen/hidden, and reset prevents stale source seeks", () => {
    const { element, requests } = fakeVideo();
    let active = false;
    const scrub = createFilmScrubber(element, { fps: 30, canSeek: () => active });
    scrub.request(5);
    expect(requests).toHaveLength(0);
    active = true;
    scrub.flush();
    expect(requests).toEqual([5]);
    scrub.request(8);
    scrub.reset();
    completeSeek(element);
    element.dispatchEvent(new Event("seeked"));
    expect(requests).toEqual([5]);
    scrub.request(2);
    scrub.destroy();
    completeSeek(element);
    element.dispatchEvent(new Event("seeked"));
    expect(requests).toEqual([5, 2]);
  });
  it("holds the target until media is ready", () => {
    const { element, requests } = fakeVideo();
    Object.defineProperty(element, "readyState", { value: 0, writable: true });
    const scrub = createFilmScrubber(element, { fps: 24, canSeek: () => true });
    scrub.request(6);
    expect(requests).toHaveLength(0);
    Object.defineProperty(element, "readyState", { value: 2 });
    element.dispatchEvent(new Event("loadeddata"));
    expect(requests).toEqual([6]);
    scrub.destroy();
  });
});
