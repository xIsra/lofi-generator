import { Dices } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getContext, start as startTone } from "tone";
import { AudioWaveVisualizer } from "@/components/lofi/audio-wave-visualizer";
import { AuroraCanvas } from "@/components/lofi/aurora-canvas";
import { LofiControls } from "@/components/lofi/lofi-controls";
import { DEFAULT_PARAMS, LofiEngine, type LofiParams } from "@/lib/lofi/engine";

function LofiGenerator() {
  const [params, setParams] = useState<LofiParams>({ ...DEFAULT_PARAMS });
  const [isPlaying, setIsPlaying] = useState(false);
  const [songInfo, setSongInfo] = useState<{
    preset: string;
    section: string;
    key: string;
  }>({ preset: "", section: "", key: "" });
  const engineRef = useRef<LofiEngine | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      setAnalyser(null);
      return;
    }
    if (!engineRef.current) {
      return;
    }
    const ctx = getContext();
    const node = ctx.createAnalyser();
    engineRef.current.connectAnalyser(node);
    setAnalyser(node);
    return () => {
      node.disconnect();
      setAnalyser(null);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!(isPlaying && engineRef.current)) {
      return;
    }
    const interval = setInterval(() => {
      setSongInfo(
        engineRef.current?.getCurrentInfo() ?? {
          preset: "",
          section: "",
          key: "",
        }
      );
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      engineRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    await startTone();
    let engine = engineRef.current;
    if (!engine) {
      engine = new LofiEngine();
      await engine.init();
      engine.setParams(params);
      engineRef.current = engine;
    }
    await engine.start();
    setIsPlaying(true);
  }, [isPlaying, params]);

  const handleRandomize = useCallback(() => {
    if (!engineRef.current) {
      return;
    }
    engineRef.current.randomize();
  }, []);

  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-[#0a0a1a] font-comfortaa">
      <AuroraCanvas className="pointer-events-none" tempo={params.tempo} />
      <div className="relative z-10 flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-4 py-8 sm:gap-12 sm:py-12">
        <h1 className="font-extralight text-5xl text-white/90 lowercase tracking-wide sm:text-7xl">
          lofi generator
        </h1>
        {(songInfo.preset || songInfo.section || songInfo.key) && (
          <p className="animate-pulse font-light text-sm text-white/50 lowercase tracking-wide">
            {[songInfo.preset, songInfo.section, songInfo.key]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <AudioWaveVisualizer
          analyser={analyser}
          className="w-full max-w-md"
          isPlaying={isPlaying}
        />
        <div className="flex items-center gap-4">
          <button
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex size-20 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.1)] backdrop-blur-md transition-all hover:bg-white/15 hover:shadow-[0_0_32px_rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            onClick={handlePlayPause}
            type="button"
          >
            {isPlaying ? (
              <div className="flex gap-1.5">
                <span className="h-6 w-1.5 rounded-full bg-white/90" />
                <span className="h-6 w-1.5 rounded-full bg-white/90" />
              </div>
            ) : (
              <svg
                aria-hidden
                className="ml-1 size-8 text-white/90"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Play</title>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            aria-label="Random song"
            className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.05)] backdrop-blur-md transition-all hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
            disabled={!isPlaying}
            onClick={handleRandomize}
            type="button"
          >
            <Dices className="size-5 text-white/80" />
          </button>
        </div>
        <LofiControls
          className="w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl"
          onParamsChange={(p) =>
            setParams((prev: LofiParams) => ({ ...prev, ...p }))
          }
          params={params}
          presetName={songInfo.preset}
          sectionName={songInfo.section}
          songKey={songInfo.key}
        />
      </div>
      <p className="relative z-10 pb-6 font-comfortaa font-light text-white/40 text-xs lowercase tracking-wide">
        created by{" "}
        <a
          className="transition-colors hover:text-white/70"
          href="https://xisra.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          xIsra
        </a>
        {" · "}
        <a
          className="transition-colors hover:text-white/70"
          href="https://github.com/xisra/lofi-generator"
          rel="noopener noreferrer"
          target="_blank"
        >
          check it on github
        </a>
      </p>
    </div>
  );
}

export default LofiGenerator;
