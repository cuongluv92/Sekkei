"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";

const STORAGE_KEY = "sekkei.welcomeShown";

// Brand palette only — no rainbow confetti colors, this is a technical tool.
const CONFETTI_COLORS = ["#4f8ff0", "#30d17f", "#e7ac4c"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  bornAt: number;
  lifeMs: number;
}

/** dir: 1 = fan inward-right (left corner), -1 = fan inward-left (right corner), 0 = fan both ways (center). */
function addBurst(
  particles: Particle[],
  x: number,
  y: number,
  count: number,
  dir: -1 | 0 | 1,
  speedMin: number,
  speedMax: number,
  now: number,
) {
  // Angle measured from horizontal: corners fan up-and-inward, center is
  // near-vertical (a real "shoots up the middle" burst, not a fan).
  const angleMin = dir === 0 ? (Math.PI / 2) * 0.78 : (Math.PI / 2) * 0.55;
  const angleMax = Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const angle = angleMin + Math.random() * (angleMax - angleMin);
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const horizontal = dir === 0 ? (Math.random() - 0.5) * 2 : dir;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed * horizontal,
      vy: -Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.35,
      bornAt: now,
      lifeMs: 1100 + Math.random() * 550,
    });
  }
}

function spawnParticles(width: number, height: number, now: number): Particle[] {
  const particles: Particle[] = [];
  addBurst(particles, 0, height, 26, 1, 6, 11, now); // bottom-left corner, fans up-and-inward
  addBurst(particles, width, height, 26, -1, 6, 11, now); // bottom-right corner, fans up-and-inward
  addBurst(particles, width / 2, height, 32, 0, 10, 15, now); // bottom-center, shoots up toward mid-screen
  return particles;
}

/**
 * One-time full-screen welcome splash — title fade-in+scale, a brief
 * on-brand confetti burst from the bottom corners, then a smooth fade to
 * the app underneath. Gated on sessionStorage so it fires once per browser
 * session (not on every client-side route change, since this lives in the
 * root layout and only unmounts itself, never remounts on navigation).
 */
export function WelcomeIntro() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [titleIn, setTitleIn] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    window.sessionStorage.setItem(STORAGE_KEY, "1");
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // One tick after mount so the initial (hidden) styles have painted —
    // otherwise the browser can coalesce the state change and skip the
    // opacity/scale transition entirely.
    const raf = requestAnimationFrame(() => setTitleIn(true));

    const timers: number[] = [];
    if (reducedMotion) {
      timers.push(window.setTimeout(() => setFadingOut(true), 1000));
      timers.push(window.setTimeout(() => setMounted(false), 1000 + 500));
    } else {
      timers.push(window.setTimeout(() => setFadingOut(true), 1950));
      timers.push(window.setTimeout(() => setMounted(false), 1950 + 550));
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [mounted, reducedMotion]);

  useEffect(() => {
    if (!mounted || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    let particles: Particle[] = [];
    let rafId: number;
    const startTimer = window.setTimeout(() => {
      particles = spawnParticles(width, height, performance.now());
    }, 500);

    const gravity = 0.16;
    function tick(now: number) {
      ctx!.clearRect(0, 0, width, height);
      particles = particles.filter((p) => now - p.bornAt < p.lifeMs);
      for (const p of particles) {
        const age = now - p.bornAt;
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        const lifeRatio = age / p.lifeMs;
        const alpha = lifeRatio < 0.7 ? 1 : Math.max(0, 1 - (lifeRatio - 0.7) / 0.3);

        ctx!.save();
        ctx!.globalAlpha = alpha;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx!.restore();
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(rafId);
    };
  }, [mounted, reducedMotion]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-[550ms] ease-out ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
      data-testid="welcome-intro"
    >
      {!reducedMotion && (
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      )}
      <div className="relative flex flex-col items-center gap-2 px-6 text-center">
        <h1
          className={`text-[34px] font-extrabold tracking-tight text-accent transition-all duration-700 ease-out ${
            titleIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          {t("app.welcomeTitle")}
        </h1>
        <p
          className={`text-[14px] text-muted transition-all delay-150 duration-700 ease-out ${
            titleIn ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          {t("app.tagline")}
        </p>
      </div>
    </div>
  );
}
