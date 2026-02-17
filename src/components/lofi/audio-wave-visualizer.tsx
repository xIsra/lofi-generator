import { useEffect, useRef } from "react";

const BAR_COUNT = 32;
const GAP = 4;
const LINE_WIDTH = 5;
const MIN_HEIGHT = 2;
const MAX_HEIGHT_RATIO = 0.7;
/** Exponential smoothing: higher = snappier response */
const AMP_HEIGHT_SMOOTH = 0.25;

interface AudioWaveVisualizerProps {
  analyser: AnalyserNode | null;
  className?: string;
  isPlaying: boolean;
}

export function AudioWaveVisualizer({
  analyser,
  isPlaying,
  className,
}: AudioWaveVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser) {
      return;
    }
    if (!isPlaying) {
      return;
    }

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    const VIEW_HEIGHT = 80;
    const CENTER_Y = VIEW_HEIGHT / 2;
    const maxH = VIEW_HEIGHT * MAX_HEIGHT_RATIO;

    /** Log-spaced bin indices (DAW EQ: more resolution in bass) */
    const binIndices = Array.from({ length: BAR_COUNT }, (_, i) => {
      const t = (i + 0.5) / BAR_COUNT;
      const logT = (10 ** (t * 1.4) - 1) / (10 ** 1.4 - 1);
      return Math.min(Math.floor(logT * (bufferLength - 1)), bufferLength - 1);
    });

    const currentHeights = new Float32Array(BAR_COUNT);

    /** Curved amplitude + boost for exaggerated response */
    const curve = (x: number) => {
      if (x <= 0) {
        return 0;
      }
      const boosted = Math.min(1, x * 1.4);
      const t = boosted * boosted * (3 - 2 * boosted);
      return t ** 0.5;
    };

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      analyser.getByteFrequencyData(data);

      const svg = svgRef.current;
      if (!svg) {
        return;
      }

      const lines = svg.querySelectorAll("line");
      const lerp = 1 - Math.exp(-AMP_HEIGHT_SMOOTH);

      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = binIndices[i];
        const raw = data[idx] ?? 0;
        const normalized = raw / 255;
        const targetH = Math.max(MIN_HEIGHT, curve(normalized) * maxH);
        const current = currentHeights[i] ?? MIN_HEIGHT;
        const smoothed = current + (targetH - current) * lerp;
        currentHeights[i] = smoothed;
        const y1 = CENTER_Y - smoothed / 2;
        const y2 = CENTER_Y + smoothed / 2;
        lines[i]?.setAttribute("y1", String(y1));
        lines[i]?.setAttribute("y2", String(y2));
      }
    };
    animate();

    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isPlaying]);

  const totalWidth = BAR_COUNT * LINE_WIDTH + (BAR_COUNT - 1) * GAP;
  const centerY = 40;
  const idleHeight = 3;

  return (
    <div aria-hidden className={className}>
      <svg
        aria-label="Audio frequency visualization"
        className="h-16 w-full max-w-md sm:h-20"
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        viewBox={`0 0 ${totalWidth} 80`}
      >
        <title>Audio frequency visualization</title>
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const x = i * (LINE_WIDTH + GAP) + LINE_WIDTH / 2;
          return (
            <line
              key={`spectrum-${x}`}
              opacity={0.85}
              stroke="white"
              strokeLinecap="round"
              strokeWidth={LINE_WIDTH}
              x1={x}
              x2={x}
              y1={isPlaying ? centerY : centerY - idleHeight / 2}
              y2={isPlaying ? centerY : centerY + idleHeight / 2}
            />
          );
        })}
      </svg>
    </div>
  );
}
