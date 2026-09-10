"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import DragonLoader from "@/components/DragonLoader";

interface Dragon3DProps {
  className?: string;
  compact?: boolean;
}

/**
 * Generate a soft radial glow particle sprite texture on an offscreen canvas.
 */
function createFlameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.2, "rgba(255, 225, 130, 0.95)");
  gradient.addColorStop(0.48, "rgba(230, 57, 70, 0.75)");
  gradient.addColorStop(0.78, "rgba(153, 27, 27, 0.3)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function Dragon3D({ className = "", compact = false }: Dragon3DProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isRoaring, setIsRoaring] = useState(false);
  const [roarCount, setRoarCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | null>(0);

  const triggerRoarRef = useRef<() => void>(() => {});

  const handleRoarClick = useCallback(() => {
    if (triggerRoarRef.current) {
      triggerRoarRef.current();
    }
  }, []);

  // Fullscreen toggle handler with native Fullscreen API support
  const toggleFullscreen = async () => {
    const el = wrapperRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (
          (el as unknown as { webkitRequestFullscreen?: () => Promise<void> })
            .webkitRequestFullscreen
        ) {
          await (
            el as unknown as { webkitRequestFullscreen: () => Promise<void> }
          ).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (
          (document as unknown as { webkitExitFullscreen?: () => Promise<void> })
            .webkitExitFullscreen
        ) {
          await (
            document as unknown as { webkitExitFullscreen: () => Promise<void> }
          ).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // Fallback toggling fullscreen state
      setIsFullscreen((prev) => !prev);
    }
  };

  // Listen for fullscreen change events (e.g. user presses Esc key)
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // Keyboard shortcut: Space or 'R' triggers roar, 'F' toggles fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === "KeyR" || e.code === "Space") {
        e.preventDefault();
        handleRoarClick();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRoarClick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0607, 0.032);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 150);
    // Camera positioned to frame the larger dragon majestically
    camera.position.set(0, 1.2, 4.8);
    camera.lookAt(0, 0.55, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Atmospheric Lighting
    const ambientLight = new THREE.AmbientLight(0x1a0a0c, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.5);
    keyLight.position.set(5, 7, 5);
    scene.add(keyLight);

    // Dragon scale rim light (noble dragon hoard gold, no green)
    const rimLight = new THREE.DirectionalLight(0xdfa84b, 2.2);
    rimLight.position.set(-6, 4, -4);
    scene.add(rimLight);

    // Molten bottom lava light (dragon blood crimson)
    const bottomLavaLight = new THREE.PointLight(0xdc2626, 4.0, 15);
    bottomLavaLight.position.set(0, -3.5, 1);
    scene.add(bottomLavaLight);

    // Mouth / Fire Light: incandescent crimson flare
    const mouthLight = new THREE.PointLight(0xe63946, 1.5, 14);
    mouthLight.position.set(0, 0.9, 1.2);
    scene.add(mouthLight);

    // 4. Volumetric 3D Fire Particle System
    const flameTexture = createFlameTexture();
    const MAX_FLAME_PARTICLES = 750;

    const flameGeo = new THREE.BufferGeometry();
    const flamePositions = new Float32Array(MAX_FLAME_PARTICLES * 3);
    const flameColors = new Float32Array(MAX_FLAME_PARTICLES * 3);
    const flameSizes = new Float32Array(MAX_FLAME_PARTICLES);

    const pVelocities: THREE.Vector3[] = [];
    const pLifetimes: number[] = [];
    const pMaxLifetimes: number[] = [];
    const pActive: boolean[] = [];

    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
      flamePositions[i * 3 + 0] = 0;
      flamePositions[i * 3 + 1] = -100;
      flamePositions[i * 3 + 2] = 0;

      flameColors[i * 3 + 0] = 1.0;
      flameColors[i * 3 + 1] = 0.6;
      flameColors[i * 3 + 2] = 0.1;

      flameSizes[i] = 0;

      pVelocities.push(new THREE.Vector3());
      pLifetimes.push(0);
      pMaxLifetimes.push(1);
      pActive.push(false);
    }

    flameGeo.setAttribute("position", new THREE.BufferAttribute(flamePositions, 3));
    flameGeo.setAttribute("color", new THREE.BufferAttribute(flameColors, 3));
    flameGeo.setAttribute("size", new THREE.BufferAttribute(flameSizes, 1));

    const flameMaterial = new THREE.PointsMaterial({
      size: 1.4,
      map: flameTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    const flameParticles = new THREE.Points(flameGeo, flameMaterial);
    scene.add(flameParticles);

    // Ambient floating embers in the undercroft
    const MAX_EMBERS = 160;
    const emberGeo = new THREE.BufferGeometry();
    const emberPositions = new Float32Array(MAX_EMBERS * 3);
    const emberVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < MAX_EMBERS; i++) {
      emberPositions[i * 3 + 0] = (Math.random() - 0.5) * 10;
      emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      emberVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          0.3 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.2
        )
      );
    }
    emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));

    const emberMaterial = new THREE.PointsMaterial({
      size: 0.22,
      map: flameTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xdfa84b,
    });
    const embers = new THREE.Points(emberGeo, emberMaterial);
    scene.add(embers);

    // 5. Load Heavy 3D Dragon Model (Fatalis GLB)
    const dragonRoot = new THREE.Group();
    scene.add(dragonRoot);

    let mixer: THREE.AnimationMixer | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let roarAction: THREE.AnimationAction | null = null;
    let headBone: THREE.Object3D | null = null;
    let jawBone: THREE.Object3D | null = null;

    const loader = new GLTFLoader();
    loader.load(
      "/models/dragon.glb",
      (gltf) => {
        const model = gltf.scene;
        setLoadProgress(null);

        // Enhance materials with dark volcanic obsidian & ember luster
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            const mesh = o as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const mat = mesh.material;
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.roughness = Math.min(mat.roughness, 0.45);
              mat.metalness = Math.max(mat.metalness, 0.4);
              mat.envMapIntensity = 1.3;
            }
          }

          if (o.name === "_j003_036") {
            headBone = o;
          }
          if (o.name === "_j004_037") {
            jawBone = o;
          }
        });

        // POSITION AND SCALE THE DRAGON TO BE BIGGER AND COMMANDING
        model.scale.set(0.235, 0.235, 0.235);
        model.position.set(0, 0.38, 0.35);
        model.rotation.set(0.05, 0, 0);
        dragonRoot.add(model);

        // Setup Skeletal Animations
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);

          idleAction = mixer.clipAction(gltf.animations[0]);
          idleAction.setLoop(THREE.LoopRepeat, Infinity);
          idleAction.play();

          const roarClip =
            gltf.animations[6] || gltf.animations[2] || gltf.animations[0];
          roarAction = mixer.clipAction(roarClip);
          roarAction.setLoop(THREE.LoopOnce, 1);
          roarAction.clampWhenFinished = false;
        }

        setTimeout(() => {
          startRoar();
        }, 1200);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (error) => {
        console.error("Error loading dragon GLB:", error);
        setLoadProgress(null);
      }
    );

    // 6. Cursor Tracking State
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      mouse.targetX = (clientX / rect.width) * 2 - 1;
      mouse.targetY = -(clientY / rect.height) * 2 + 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    // 7. Animation & Roar Logic
    let lastTime = performance.now();
    const startTime = performance.now();
    let roarProgress = 0;
    let roarActive = false;
    let cameraShake = 0;

    const startRoar = () => {
      if (roarActive) return;
      roarActive = true;
      roarProgress = 0.01;
      setIsRoaring(true);
      setRoarCount((c) => c + 1);

      if (roarAction && idleAction) {
        roarAction.reset();
        roarAction.fadeIn(0.25).play();
        idleAction.crossFadeTo(roarAction, 0.25, false);
      }
    };

    triggerRoarRef.current = startRoar;

    const mouthWorldPos = new THREE.Vector3();
    const mouthDirection = new THREE.Vector3();

    const spawnFlameParticle = (intensity: number) => {
      if (headBone) {
        headBone.getWorldPosition(mouthWorldPos);
        headBone.getWorldDirection(mouthDirection);
      } else {
        mouthWorldPos.set(0, 0.8, 1.4);
        mouthDirection.set(0, 0.1, 1).normalize();
      }

      let index = -1;
      for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
        if (!pActive[i]) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        index = Math.floor(Math.random() * MAX_FLAME_PARTICLES);
      }

      pActive[index] = true;
      pLifetimes[index] = 0;
      pMaxLifetimes[index] = 0.75 + Math.random() * 0.55;

      const startX =
        mouthWorldPos.x +
        mouthDirection.x * 0.6 +
        (Math.random() - 0.5) * 0.15;
      const startY =
        mouthWorldPos.y +
        mouthDirection.y * 0.6 +
        (Math.random() - 0.5) * 0.15;
      const startZ =
        mouthWorldPos.z +
        mouthDirection.z * 0.6 +
        (Math.random() - 0.5) * 0.15;

      flamePositions[index * 3 + 0] = startX;
      flamePositions[index * 3 + 1] = startY;
      flamePositions[index * 3 + 2] = startZ;

      const speed = (6.0 + Math.random() * 4.5) * intensity;
      const spread = 0.42;
      pVelocities[index].set(
        mouthDirection.x * speed + (Math.random() - 0.5) * spread * speed,
        mouthDirection.y * speed +
          (Math.random() - 0.25) * spread * speed +
          0.3,
        mouthDirection.z * speed + (Math.random() - 0.5) * spread * speed
      );
    };

    // 8. Main Render Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const time = (now - startTime) / 1000;

      if (mixer) {
        mixer.update(delta);
      }

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      if (!roarActive) {
        dragonRoot.rotation.y = -mouse.x * 0.25;
        dragonRoot.rotation.x = 0.04 + -mouse.y * 0.14;

        const breath = Math.sin(time * 2.2);
        mouthLight.intensity = 1.2 + breath * 0.6;
        mouthLight.color.setHex(0xe63946); // deep dragon blood crimson flame

        if (jawBone) {
          jawBone.rotation.x = Math.max(0, breath * 0.05);
        }
      } else {
        roarProgress += delta * 0.5;

        if (roarProgress < 0.25) {
          const p = roarProgress / 0.25;
          dragonRoot.position.z = -p * 0.3;
          mouthLight.intensity = 2.0 + p * 4.0;
        } else if (roarProgress < 0.75) {
          const p = (roarProgress - 0.25) / 0.5;
          const strike = Math.sin(p * Math.PI);

          dragonRoot.position.z = -0.3 + strike * 0.5;
          if (jawBone) {
            jawBone.rotation.x = 0.5 + Math.sin(time * 20) * 0.08;
          }

          mouthLight.intensity = 10.0 + Math.random() * 5.0;
          mouthLight.color.setHex(0xffec99);

          cameraShake = 0.14 * strike;

          const spawnCount = Math.floor(12 + Math.random() * 8);
          for (let s = 0; s < spawnCount; s++) {
            spawnFlameParticle(1.0);
          }
        } else if (roarProgress < 1.0) {
          const p = (roarProgress - 0.75) / 0.25;
          dragonRoot.position.z = 0.2 * (1 - p);
          mouthLight.intensity = 10.0 * (1 - p) + 1.2;

          if (Math.random() < 0.4) {
            spawnFlameParticle(0.4);
          }
        } else {
          roarActive = false;
          setIsRoaring(false);

          if (roarAction && idleAction) {
            roarAction.crossFadeTo(idleAction, 0.4, false);
            idleAction.play();
          }
        }
      }

      if (headBone) {
        headBone.getWorldPosition(mouthWorldPos);
        mouthLight.position.copy(mouthWorldPos);
      }

      // Update flame particles
      const posAttr = flameGeo.attributes.position as THREE.BufferAttribute;
      const colAttr = flameGeo.attributes.color as THREE.BufferAttribute;
      const sizeAttr = flameGeo.attributes.size as THREE.BufferAttribute;

      for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
        if (!pActive[i]) continue;

        pLifetimes[i] += delta;
        const progress = pLifetimes[i] / pMaxLifetimes[i];

        if (progress >= 1.0) {
          pActive[i] = false;
          flamePositions[i * 3 + 1] = -100;
          flameSizes[i] = 0;
          continue;
        }

        flamePositions[i * 3 + 0] += pVelocities[i].x * delta;
        flamePositions[i * 3 + 1] += pVelocities[i].y * delta;
        flamePositions[i * 3 + 2] += pVelocities[i].z * delta;

        pVelocities[i].y += 2.8 * delta;
        pVelocities[i].x += Math.sin(time * 14 + i) * 0.4 * delta;

        flameSizes[i] = (1.4 + progress * 5.2) * (1.0 - progress * 0.4);

        if (progress < 0.2) {
          // Incandescent gold core
          colAttr.setXYZ(i, 1.0, 0.95, 0.7);
        } else if (progress < 0.5) {
          // Transition to blazing dragon crimson
          const t = (progress - 0.2) / 0.3;
          colAttr.setXYZ(i, 0.95 - t * 0.05, 0.8 - t * 0.58, 0.25 - t * 0.15);
        } else if (progress < 0.8) {
          // Deep ruby dragon blood red
          const t = (progress - 0.5) / 0.3;
          colAttr.setXYZ(i, 0.9 - t * 0.3, 0.22 - t * 0.15, 0.1 - t * 0.05);
        } else {
          // Dark obsidian volcanic ash
          const t = (progress - 0.8) / 0.2;
          colAttr.setXYZ(i, 0.4 * (1 - t), 0.06 * (1 - t), 0.05 * (1 - t));
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      // Update ambient embers
      const emberPosAttr = emberGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < MAX_EMBERS; i++) {
        emberPositions[i * 3 + 0] += emberVelocities[i].x * delta;
        emberPositions[i * 3 + 1] += emberVelocities[i].y * delta;
        emberPositions[i * 3 + 2] += emberVelocities[i].z * delta;

        if (emberPositions[i * 3 + 1] > 4.5) {
          emberPositions[i * 3 + 1] = -3.5;
          emberPositions[i * 3 + 0] = (Math.random() - 0.5) * 8;
          emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
        }
      }
      emberPosAttr.needsUpdate = true;

      // Apply camera shake
      if (cameraShake > 0.001) {
        camera.position.x = (Math.random() - 0.5) * cameraShake;
        camera.position.y = 1.2 + (Math.random() - 0.5) * cameraShake;
        cameraShake *= 0.92;
      } else {
        camera.position.x = 0;
        camera.position.y = 1.2;
      }
      camera.lookAt(0, 0.55, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler ensures Three.js canvas matches container dimensions
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    // ResizeObserver watches the container whenever fullscreen or layout changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      flameTexture.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden rounded-lg border border-ember/25 bg-gradient-to-b from-panel-2/95 via-panel/95 to-void shadow-[0_0_60px_rgba(230,57,70,0.2)] backdrop-blur-md transition-all duration-300 ${
        isFullscreen
          ? "!fixed !inset-0 !z-[9999] !h-screen !w-screen !rounded-none !border-none"
          : compact
            ? "h-[360px] w-full"
            : "h-[500px] w-full lg:h-[580px]"
      } ${className}`}
    >
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative h-full w-full cursor-crosshair touch-none"
      />

      {/* Loading Overlay */}
      {loadProgress !== null && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/90 backdrop-blur-md p-6">
          <DragonLoader
            progress={loadProgress}
            size={compact ? "sm" : "md"}
          />
        </div>
      )}

      {/* Atmospheric HUD telemetry */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            isRoaring
              ? "animate-ping bg-danger"
              : "animate-breathe bg-scale"
          }`}
        />
        <span className="text-[10px] font-mono tracking-widest text-ink-dim uppercase">
          {isRoaring ? (
            <span className="text-ember font-bold">BREATH OF FLAME // ACTIVE</span>
          ) : (
            <span>FATALIS // ELDER DRAKE ONLINE</span>
          )}
        </span>
      </div>

      <div className="pointer-events-none absolute top-3 right-3 text-[10px] font-mono text-ember/50">
        ROARS: {String(roarCount).padStart(2, "0")}
      </div>

      {/* Interactive Controls Bar */}
      <div className="absolute right-3 bottom-3 left-3 flex flex-wrap items-center justify-between gap-2 border-t border-ember/15 bg-void/85 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Main Roar Button */}
          <button
            type="button"
            onClick={handleRoarClick}
            disabled={isRoaring}
            className={`group relative flex items-center gap-2 overflow-hidden rounded border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all ${
              isRoaring
                ? "border-danger bg-danger/20 text-danger shadow-[0_0_20px_rgba(224,52,74,0.5)]"
                : "border-ember bg-ember/20 text-ember hover:border-ember hover:bg-ember hover:text-void shadow-[0_0_15px_rgba(230,57,70,0.3)]"
            }`}
          >
            <span className="inline-block transition-transform group-hover:scale-125">
              🔥
            </span>
            <span>{isRoaring ? "ROARING..." : "UNLEASH FIRE"}</span>
            <span className="hidden text-[9px] opacity-70 sm:inline">
              (KEY: R / SPACE)
            </span>
          </button>
        </div>

        {/* Real Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 rounded border border-ember/25 bg-panel px-3 py-2 text-[10px] font-bold tracking-wider text-ink-dim transition-colors hover:border-ember hover:text-ember"
        >
          <span>{isFullscreen ? "✕ EXIT FULLSCREEN" : "⛶ FULLSCREEN"}</span>
          <span className="hidden text-[8px] opacity-60 sm:inline">(F)</span>
        </button>
      </div>

      {/* Guidance micro-prompt */}
      <div className="pointer-events-none absolute bottom-14 left-4 hidden text-[9px] tracking-widest text-ink-dim/60 sm:block">
        CURSOR MOVES THE DRAKE · HIT &quot;R&quot; OR &quot;SPACE&quot; TO ROAR · &quot;F&quot; FOR FULLSCREEN
      </div>
    </div>
  );
}
