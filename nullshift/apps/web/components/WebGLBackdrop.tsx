"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The site's ONE WebGL context (per the single-context rule): a fixed,
 * full-viewport fragment-shader field that flows as you scroll. A near-black
 * base (token --bg) keeps it reading as the page canvas, with emerald→cyan
 * aurora bands warping on `uScroll`. Sits behind everything (pointer-events
 * none, z-0); only transparent sections let it show through. Honours
 * prefers-reduced-motion (renders a single still frame, no rAF loop) and
 * pauses when the tab is hidden. Disposes the context fully on unmount.
 */
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uScroll;
  uniform vec2  uRes;

  // cheap value-noise fbm — no textures, a few octaves
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv;
    p.x *= uRes.x / max(uRes.y, 1.0);

    float t = uTime * 0.035;
    // scroll drags the field upward and warps it
    p.y += uScroll * 1.6;
    p += 0.12 * vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t));

    float n1 = fbm(p * 1.6 + vec2(t, -t * 0.6));
    float n2 = fbm(p * 3.2 - vec2(t * 0.8, t));
    float flow = n1 * 0.7 + n2 * 0.3;

    vec3 base    = vec3(0.039, 0.043, 0.059); // #0A0B0F page canvas
    vec3 emerald = vec3(0.063, 0.725, 0.506); // #10b981
    vec3 cyan    = vec3(0.239, 0.843, 0.898); // #3DD7E5

    vec3 col = base;
    col = mix(col, emerald, smoothstep(0.42, 0.86, flow) * 0.5);
    col = mix(col, cyan, smoothstep(0.70, 0.97, flow) * 0.30 * (0.35 + uScroll * 0.9));

    // faint moving grain so flat areas don't band
    col += (hash(uv * uRes + t) - 0.5) * 0.015;

    // vignette toward the page colour at the edges
    float vig = smoothstep(1.25, 0.15, length(uv - 0.5));
    col = mix(base, col, mix(0.55, 1.0, vig));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function WebGLBackdrop() {
  const mountRef = useRef<HTMLDivElement>(null);
  // Debug escape hatch: ?nogl disables the context (used to take non-GPU
  // screenshots; some headless capture pipelines render WebGL pages black).
  const disabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("nogl");

  useEffect(() => {
    if (disabled) return;
    const mount = mountRef.current;
    if (!mount) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      return; // no WebGL — the page degrades to its solid background
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function scrollProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    }

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      uniforms.uRes.value.set(w, h);
    }
    window.addEventListener("resize", resize);

    let raf = 0;
    let running = true;
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();

    function frame(now: number) {
      uniforms.uTime.value = (now - start) / 1000;
      uniforms.uScroll.value += (scrollProgress() - uniforms.uScroll.value) * 0.08;
      renderer.render(scene, camera);
      if (running) raf = requestAnimationFrame(frame);
    }

    if (reduced) {
      uniforms.uScroll.value = scrollProgress();
      renderer.render(scene, camera); // one still frame, no loop
    } else {
      raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (reduced) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount)
        mount.removeChild(renderer.domElement);
    };
  }, [disabled]);

  if (disabled) return null;

  return (
    <div
      ref={mountRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
