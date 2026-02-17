import { useEffect, useRef } from "react";

const AURORA_COLORS = [
  [0.75, 0.65, 0.9], // lavender
  [0.95, 0.75, 0.85], // rose
  [0.7, 0.9, 0.85], // mint
  [1.0, 0.85, 0.75], // peach
  [0.7, 0.85, 1.0], // sky blue
];

interface AuroraCanvasProps {
  className?: string;
  tempo?: number;
}

export function AuroraCanvas({ tempo = 75, className }: AuroraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);
  const blobsRef = useRef(
    Array.from({ length: 5 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.5 + 0.25,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.02,
      radius: 0.3 + Math.random() * 0.4,
      colorIdx: Math.floor(Math.random() * AURORA_COLORS.length),
    }))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio ?? 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Base dark background
    const baseR = 10 / 255;
    const baseG = 10 / 255;
    const baseB = 26 / 255;

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      tRef.current += 0.004 * (tempo / 75);

      ctx.fillStyle = `rgb(${Math.floor(baseR * 255)}, ${Math.floor(baseG * 255)}, ${Math.floor(baseB * 255)})`;
      ctx.fillRect(0, 0, w, h);

      const t = tRef.current;
      const blobs = blobsRef.current;

      blobs.forEach((blob, i) => {
        const phase = blob.phase + t * blob.speed;
        const cx =
          w * (blob.x + Math.sin(phase) * 0.15 + Math.sin(phase * 0.7) * 0.1);
        const cy =
          h *
          (blob.y +
            Math.cos(phase * 0.8) * 0.08 +
            Math.sin(phase * 1.3 + i) * 0.05);
        const r = w * blob.radius * (0.9 + Math.sin(t + i) * 0.15);

        const [cr, cg, cb] = AURORA_COLORS[blob.colorIdx];
        const alpha = 0.12 + Math.sin(t * 2 + i) * 0.04;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(
          0,
          `rgba(${cr * 255}, ${cg * 255}, ${cb * 255}, ${alpha * 0.8})`
        );
        gradient.addColorStop(
          0.4,
          `rgba(${cr * 255}, ${cg * 255}, ${cb * 255}, ${alpha * 0.3})`
        );
        gradient.addColorStop(
          0.7,
          `rgba(${cr * 255}, ${cg * 255}, ${cb * 255}, ${alpha * 0.1})`
        );
        gradient.addColorStop(1, "rgba(255,255,255,0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      });

      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [tempo]);

  return (
    <canvas
      aria-hidden
      className={className}
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
