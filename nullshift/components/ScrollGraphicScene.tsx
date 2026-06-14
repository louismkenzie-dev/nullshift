"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const COLORS = {
  primary: 0x00c85a, // emerald
  bright: 0x00ff7a, // bright emerald
};

interface Props {
  progressRef: React.MutableRefObject<number>;
}

// Sequential hand-off windows (section progress). The gyroscope fully fades
// and recedes OUT before the neural sphere begins resolving IN — they never
// overlap. The canvas-wrapper blur for the swap (in ScrollVideoSection) peaks
// at the seam (~0.63) over this same window, so keep the two in sync.
const GYRO_OUT_START = 0.53;
const GYRO_OUT_END = 0.63;
const NEURAL_IN_START = 0.63;
const NEURAL_IN_END = 0.73;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

type MatRef = { mat: THREE.Material & { opacity: number; transparent: boolean }; base: number };

/**
 * Both "Glass & Metal Relight" graphics — the armillary Gyroscope and the
 * Neural Sphere — living in ONE WebGL context. They share the procedural
 * studio environment, lighting and a ground shadow. Scroll progress drives
 * the rotation (scroll-jog) and an in-canvas crossfade: the gyroscope holds
 * through panels 01–02, then dissolves as the neural sphere materialises for
 * panel 03. A single context is required — multiple WebGL contexts are not
 * reliable across browsers (the older one gets evicted).
 */
export default function ScrollGraphicScene({ progressRef }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    let size = 600;
    renderer.setSize(size, size, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 5.8;

    // ── Procedural studio env map (shared) ────────────────────────
    function buildEnvironment() {
      const w = 1024, h = 512;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0.0, "#0a1410");
      bg.addColorStop(0.5, "#05080a");
      bg.addColorStop(1.0, "#01030a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const blob = (x: number, y: number, r: number, col: string, a: number) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      };
      blob(260, 120, 200, "#ffffff", 0.95);
      blob(800, 150, 230, "#bfe9ff", 0.5);
      blob(540, 430, 320, "#00C85A", 0.55);
      blob(150, 360, 160, "#00FF7A", 0.45);
      blob(900, 380, 150, "#00C85A", 0.4);
      blob(470, 60, 70, "#ffffff", 0.9);
      blob(680, 470, 90, "#7dffb0", 0.5);

      ctx.save();
      ctx.filter = "blur(5px)";
      ctx.globalAlpha = 0.9; ctx.fillStyle = "#ffffff";
      ctx.fillRect(120, 88, 175, 26);
      ctx.fillRect(360, 66, 120, 18);
      ctx.globalAlpha = 0.6; ctx.fillStyle = "#cfeefe";
      ctx.fillRect(760, 112, 150, 22);
      ctx.globalAlpha = 0.5; ctx.fillStyle = "#00FF7A";
      ctx.fillRect(300, 300, 260, 14);
      ctx.restore();
      ctx.globalAlpha = 1;

      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;

      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      pmrem.dispose();
      return rt.texture;
    }
    scene.environment = buildEnvironment();

    // Master group carries the scroll-jog rotation; each graphic is a child.
    const master = new THREE.Group();
    scene.add(master);

    // Track materials per graphic with their base opacity so the crossfade
    // multiplies (preserving additive/glass base alphas) rather than clobbers.
    const gyroMats: MatRef[] = [];
    const neuralMats: MatRef[] = [];
    const reg = (list: MatRef[], mat: THREE.Material) => {
      const m = mat as MatRef["mat"];
      list.push({ mat: m, base: m.opacity ?? 1 });
      return mat;
    };

    const darkMetal = new THREE.MeshPhysicalMaterial({
      color: 0x0b0e0d, metalness: 1.0, roughness: 0.22,
      clearcoat: 1.0, clearcoatRoughness: 0.12, envMapIntensity: 1.3,
    });
    const darkPolish = new THREE.MeshPhysicalMaterial({
      color: 0x05070a, metalness: 1.0, roughness: 0.05,
      clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.9,
    });

    // ========================================================================
    // GYROSCOPE
    // ========================================================================
    const gyroGroup = new THREE.Group();
    master.add(gyroGroup);
    reg(gyroMats, darkMetal);
    reg(gyroMats, darkPolish);

    const ringA = new THREE.Group();
    const ringAMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.024, 24, 240),
      reg(gyroMats, new THREE.MeshPhysicalMaterial({
        color: COLORS.primary, metalness: 1.0, roughness: 0.06,
        clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.6,
      }))
    );
    ringAMesh.rotation.x = Math.PI / 2;
    ringA.add(ringAMesh);

    const ringRadius = 1.85;
    const gemGeo = new THREE.SphereGeometry(0.045, 24, 24);
    const gemMat = reg(gyroMats, new THREE.MeshPhysicalMaterial({
      color: COLORS.bright, metalness: 0.0, roughness: 0.06,
      clearcoat: 1.0, clearcoatRoughness: 0.03,
      emissive: COLORS.bright, emissiveIntensity: 1.1, envMapIntensity: 1.3,
    }));
    const puckGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.08, 32);
    const upVec = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const puck = new THREE.Mesh(puckGeo, darkMetal);
      puck.position.copy(dir).multiplyScalar(ringRadius);
      puck.quaternion.setFromUnitVectors(upVec, dir);
      ringA.add(puck);
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.copy(dir).multiplyScalar(ringRadius + 0.03);
      ringA.add(gem);
    }
    gyroGroup.add(ringA);

    const ringB = new THREE.Group();
    ringB.add(new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.055, 32, 256),
      reg(gyroMats, new THREE.MeshPhysicalMaterial({
        color: 0xeafff3, metalness: 0.0, roughness: 0.03,
        transmission: 1.0, thickness: 0.6, ior: 1.5,
        attenuationColor: new THREE.Color(COLORS.primary),
        attenuationDistance: 0.8,
        clearcoat: 1.0, clearcoatRoughness: 0.02,
        specularIntensity: 1.0, envMapIntensity: 1.5, transparent: true,
      }))
    ));
    ringB.rotation.x = 1.1;
    gyroGroup.add(ringB);

    const ringC = new THREE.Group();
    ringC.add(new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.026, 24, 220),
      reg(gyroMats, new THREE.MeshPhysicalMaterial({
        color: COLORS.bright, metalness: 1.0, roughness: 0.12,
        emissive: COLORS.bright, emissiveIntensity: 0.35,
        clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.5,
      }))
    ));
    ringC.rotation.y = 0.6;
    gyroGroup.add(ringC);

    gyroGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 64, 64),
      reg(gyroMats, new THREE.MeshPhysicalMaterial({
        color: 0x020a04, metalness: 1.0, roughness: 0.02,
        clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: 2.0,
      }))
    ));
    gyroGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.30, 48, 48),
      reg(gyroMats, new THREE.MeshBasicMaterial({
        color: COLORS.bright, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }))
    ));

    const axle = new THREE.Group();
    axle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.04, 32), darkMetal));
    const gTipGeo = new THREE.SphereGeometry(0.062, 32, 32);
    const gTipTop = new THREE.Mesh(gTipGeo, darkPolish); gTipTop.position.y = 0.52;
    const gTipBot = new THREE.Mesh(gTipGeo, darkPolish); gTipBot.position.y = -0.52;
    axle.add(gTipTop, gTipBot);
    gyroGroup.add(axle);

    const hub = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 24, 120), darkMetal);
    hub.rotation.x = Math.PI / 2;
    gyroGroup.add(hub);

    const orbiterMat = reg(gyroMats, new THREE.MeshPhysicalMaterial({
      color: COLORS.primary, metalness: 1.0, roughness: 0.08,
      clearcoat: 1.0, clearcoatRoughness: 0.05,
      emissive: COLORS.primary, emissiveIntensity: 0.5, envMapIntensity: 1.4,
    }));
    const orbiterGeo = new THREE.SphereGeometry(0.05, 24, 24);
    const orbiterParams = [
      { rx: 1.1, rz: 0.8, speed: 0.7 },
      { rx: 0.7, rz: 1.2, speed: 1.1 },
      { rx: 1.3, rz: 0.5, speed: 0.5 },
    ];
    const orbiters = orbiterParams.map((p) => {
      const m = new THREE.Mesh(orbiterGeo, orbiterMat);
      gyroGroup.add(m);
      return { mesh: m, ...p };
    });

    // ========================================================================
    // NEURAL SPHERE
    // ========================================================================
    const neuralWrap = new THREE.Group();
    master.add(neuralWrap);

    const neuralGroup = new THREE.Group();
    neuralWrap.add(neuralGroup);

    const ico = new THREE.IcosahedronGeometry(2.0, 3);
    const posAttr = ico.attributes.position;
    const seenV = new Map<string, number>();
    const verts: THREE.Vector3[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const k = v.x.toFixed(3) + "|" + v.y.toFixed(3) + "|" + v.z.toFixed(3);
      if (!seenV.has(k)) { seenV.set(k, verts.length); verts.push(v); }
    }
    ico.dispose();

    const TH = 0.75;
    const adj: number[][] = verts.map(() => []);
    const linePts: THREE.Vector3[] = [];
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        if (verts[i].distanceTo(verts[j]) < TH) {
          linePts.push(verts[i], verts[j]);
          adj[i].push(j); adj[j].push(i);
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    neuralGroup.add(new THREE.LineSegments(lineGeo, reg(neuralMats, new THREE.LineBasicMaterial({
      color: COLORS.primary, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))));

    const baseCol = new THREE.Color(COLORS.primary);
    const brightCol = new THREE.Color(COLORS.bright);
    const BASE_EMISSIVE = 0.7;
    const PEAK_EMISSIVE = 2.6;
    const nodeGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const nodes = verts.map((v) => {
      const mat = reg(neuralMats, new THREE.MeshPhysicalMaterial({
        color: COLORS.primary, metalness: 0.0, roughness: 0.08,
        clearcoat: 1.0, clearcoatRoughness: 0.04,
        emissive: COLORS.primary, emissiveIntensity: BASE_EMISSIVE,
        envMapIntensity: 1.2,
      })) as THREE.MeshPhysicalMaterial;
      const m = new THREE.Mesh(nodeGeo, mat);
      m.position.copy(v);
      neuralGroup.add(m);
      return { mesh: m, mat, pulseStart: -Infinity };
    });

    neuralGroup.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.1, 1),
      reg(neuralMats, new THREE.MeshBasicMaterial({
        color: COLORS.primary, wireframe: true,
        transparent: true, opacity: 0.08,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }))
    ));

    const neuralCage = new THREE.Group();
    neuralWrap.add(neuralCage);

    const glassRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.32, 0.05, 32, 256),
      reg(neuralMats, new THREE.MeshPhysicalMaterial({
        color: 0xeafff3, metalness: 0.0, roughness: 0.03,
        transmission: 1.0, thickness: 0.6, ior: 1.5,
        attenuationColor: new THREE.Color(COLORS.primary),
        attenuationDistance: 0.9,
        clearcoat: 1.0, clearcoatRoughness: 0.02,
        envMapIntensity: 1.5, transparent: true,
      }))
    );
    glassRing.rotation.set(1.18, 0, 0);
    neuralCage.add(glassRing);

    const metalRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.32, 0.028, 24, 240),
      reg(neuralMats, new THREE.MeshPhysicalMaterial({
        color: COLORS.primary, metalness: 1.0, roughness: 0.08,
        clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.6,
      }))
    );
    metalRing.rotation.set(-0.32, 0.7, 0.2);
    metalRing.castShadow = true;
    neuralCage.add(metalRing);

    const nPuckGeo = new THREE.CylinderGeometry(0.085, 0.11, 0.07, 28);
    [1, -1].forEach((s) => {
      const puck = new THREE.Mesh(nPuckGeo, darkMetal);
      const dir = new THREE.Vector3(0, s, 0).applyEuler(metalRing.rotation);
      puck.position.copy(dir.clone().multiplyScalar(2.32));
      puck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      puck.castShadow = true;
      neuralCage.add(puck);
    });

    neuralCage.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 64, 64),
      reg(neuralMats, new THREE.MeshPhysicalMaterial({
        color: 0x020a04, metalness: 1.0, roughness: 0.02,
        clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: 2.0,
      }))
    ));
    neuralCage.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 48, 48),
      reg(neuralMats, new THREE.MeshBasicMaterial({
        color: COLORS.bright, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }))
    ));

    // ── Lighting (shared) ─────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    const p1 = new THREE.PointLight(COLORS.bright, 2.4, 0, 1.6);
    p1.position.set(4, 4, 4);
    scene.add(p1);
    const p2 = new THREE.PointLight(0xffffff, 0.6);
    p2.position.set(-3, -2, -2);
    scene.add(p2);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.5, 6, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 24;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.radius = 7;
    key.shadow.bias = -0.0006;
    scene.add(key);

    const rimL = new THREE.PointLight(COLORS.primary, 1.4, 14, 2);
    rimL.position.set(-6, 1, 1);
    scene.add(rimL);
    const rimR = new THREE.PointLight(COLORS.bright, 1.0, 14, 2);
    rimR.position.set(6, -1, -1);
    scene.add(rimR);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.5 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.85;
    ground.receiveShadow = true;
    scene.add(ground);

    // shadows for solid meshes (skip transmission glass)
    gyroGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) { o.castShadow = true; (o as THREE.Mesh).receiveShadow = true; }
    });
    ringB.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });

    // ── Crossfade helper ──────────────────────────────────────────
    const applyOpacity = (list: MatRef[], factor: number) => {
      const full = factor >= 0.999;
      for (const { mat, base } of list) {
        if (full) { mat.transparent = base < 1; mat.opacity = base; }
        else { mat.transparent = true; mat.opacity = base * factor; }
      }
    };

    // ── Pulse ─────────────────────────────────────────────────────
    const HOLD = 0.18, FADE = 0.5;
    let lastPulse = 0;
    const firePulse = (elapsed: number) => {
      const i = Math.floor(Math.random() * nodes.length);
      for (const idx of [i, ...adj[i]]) nodes[idx].pulseStart = elapsed;
    };

    // ── Animation loop ────────────────────────────────────────────
    const timer = new THREE.Timer();
    const tmpCol = new THREE.Color();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      timer.update();
      const elapsed = timer.getElapsed();
      const p = progressRef.current;

      // Sequential hand-off: gyroscope fades + recedes out, THEN neural sphere
      // resolves + emerges in. No overlap — the wrapper blur (ScrollVideoSection)
      // peaks at the seam so each dissolves through blur rather than popping.
      const gyroVis = 1 - smoothstep(GYRO_OUT_START, GYRO_OUT_END, p);
      const neuralVis = smoothstep(NEURAL_IN_START, NEURAL_IN_END, p);

      gyroGroup.visible = gyroVis > 0.001;
      neuralWrap.visible = neuralVis > 0.001;
      applyOpacity(gyroMats, gyroVis);
      applyOpacity(neuralMats, neuralVis);
      // Depth: recede out (scale down) / emerge in (scale up)
      gyroGroup.scale.setScalar(0.72 + 0.28 * gyroVis);
      neuralWrap.scale.setScalar(0.72 + 0.28 * neuralVis);

      if (gyroGroup.visible) {
        ringA.rotation.z += 0.003;
        ringB.rotation.x += 0.005;
        ringC.rotation.y += 0.008;
        for (const o of orbiters) {
          o.mesh.position.set(
            Math.cos(elapsed * o.speed) * o.rx,
            Math.sin(elapsed * o.speed * 0.3) * 0.4,
            Math.sin(elapsed * o.speed) * o.rz
          );
        }
      }

      if (neuralWrap.visible) {
        if (elapsed - lastPulse > 1.2) { lastPulse = elapsed; firePulse(elapsed); }
        for (const n of nodes) {
          const t = elapsed - n.pulseStart;
          let level = 0;
          if (t >= 0 && t < HOLD) level = 1;
          else if (t >= HOLD && t < HOLD + FADE) level = 1 - (t - HOLD) / FADE;
          n.mat.emissiveIntensity = BASE_EMISSIVE + (PEAK_EMISSIVE - BASE_EMISSIVE) * level;
          tmpCol.copy(baseCol).lerp(brightCol, level);
          n.mat.color.copy(tmpCol);
          n.mat.emissive.copy(tmpCol);
          n.mesh.scale.setScalar(1 + 0.6 * level);
        }
        neuralGroup.rotation.y += 0.0007;
        neuralGroup.rotation.x += 0.0002;
        neuralCage.rotation.y += 0.0004;
      }

      // scroll-jog
      master.rotation.y = p * Math.PI * 4;
      master.rotation.x = Math.sin(p * Math.PI * 2) * 0.4;

      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          size = w;
          camera.aspect = 1;
          camera.updateProjectionMatrix();
          renderer.setSize(size, size, false);
        }
      }
    });
    ro.observe(shell);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    };
  }, [progressRef]);

  return (
    <div
      ref={shellRef}
      className="relight-shell"
      style={{
        position: "relative",
        background: `
          radial-gradient(120% 90% at 50% 40%, rgba(0,200,90,0.12) 0%, rgba(0,46,26,0.04) 40%, rgba(0,0,0,0) 72%),
          radial-gradient(48% 26% at 50% 80%, rgba(0,255,122,0.06) 0%, rgba(0,0,0,0) 78%)
        `,
        // Extra-gradual radial feather (multi-stop) so the canvas dissolves into
        // the page with no visible ring or hard edge anywhere.
        WebkitMaskImage: "radial-gradient(135% 130% at 50% 48%, #000 38%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0) 100%)",
        maskImage: "radial-gradient(135% 130% at 50% 48%, #000 38%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0) 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
