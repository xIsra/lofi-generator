import { ChevronDownIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_PARAMS,
  INSTRUMENT_IDS,
  type LofiParams,
} from "@/lib/lofi/engine";
import { cn } from "@/lib/utils";

function getWarmthLabel(cutoff: number): string {
  if (cutoff < 1000) {
    return "warm";
  }
  if (cutoff < 2500) {
    return "balanced";
  }
  return "bright";
}

interface LofiControlsProps {
  className?: string;
  onParamsChange: (p: Partial<LofiParams>) => void;
  params: LofiParams;
  presetName?: string;
  sectionName?: string;
  songKey?: string;
}

const SLIDER_CLASS =
  "[&_[data-slot=slider-track]]:bg-white/20 [&_[data-slot=slider-range]]:bg-white/40 [&_[data-slot=slider-thumb]]:border-white/30 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_0_8px_rgba(255,255,255,0.3)]";

export function LofiControls({
  params,
  onParamsChange,
  className,
  presetName,
  sectionName,
  songKey,
}: LofiControlsProps) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const info = [presetName, sectionName, songKey].filter(Boolean).join(" · ");
  return (
    <div
      className={cn(
        "relative w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-8",
        className
      )}
    >
      <Button
        aria-label="Reset all controls"
        className="absolute top-2 right-2 text-white/50 hover:bg-white/10 hover:text-white/70"
        onClick={() => onParamsChange({ ...DEFAULT_PARAMS })}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <RotateCcw className="size-5" strokeWidth={1.25} />
      </Button>
      {info ? (
        <p className="mb-3 truncate pr-10 font-comfortaa font-light text-white/40 text-xs lowercase tracking-wide">
          {info}
        </p>
      ) : (
        <div className="h-8" />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Control
          className={SLIDER_CLASS}
          label="volume"
          onChange={(v) => onParamsChange({ volume: v / 100 })}
          sliderValue={[p.volume * 100]}
          value={`${Math.round(p.volume * 100)}%`}
        />
        <Control
          className={SLIDER_CLASS}
          label="tempo"
          onChange={(v) =>
            onParamsChange({ tempo: Math.round(60 + (v / 100) * 30) })
          }
          sliderValue={[((p.tempo - 60) / 30) * 100]}
          value={`${p.tempo} bpm`}
        />
        <Control
          className={SLIDER_CLASS}
          label="warmth"
          onChange={(v) =>
            onParamsChange({
              filterCutoff: Math.round(200 + (v / 100) * 4800),
            })
          }
          sliderValue={[((p.filterCutoff - 200) / 4800) * 100]}
          value={getWarmthLabel(p.filterCutoff)}
        />
        <Control
          className={SLIDER_CLASS}
          label="space"
          onChange={(v) => onParamsChange({ reverbMix: v / 100 })}
          sliderValue={[p.reverbMix * 100]}
          value={`${Math.round(p.reverbMix * 100)}%`}
        />
        <Control
          className={SLIDER_CLASS}
          label="echo"
          onChange={(v) => onParamsChange({ delayMix: v / 100 })}
          sliderValue={[p.delayMix * 100]}
          value={`${Math.round(p.delayMix * 100)}%`}
        />
        <Control
          className={SLIDER_CLASS}
          label="crackle"
          onChange={(v) => onParamsChange({ crackleMix: v / 100 })}
          sliderValue={[p.crackleMix * 100]}
          value={`${Math.round(p.crackleMix * 100)}%`}
        />
      </div>
      <Collapsible className="group/collapse mt-4">
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md py-2 font-comfortaa font-light text-[13px] text-white/60 lowercase tracking-wide hover:text-white/80">
          instruments
          <ChevronDownIcon className="size-4 shrink-0 text-white/40 transition-transform group-data-[state=open]/collapse:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {INSTRUMENT_IDS.map((id) => {
              const vols = p.instrumentVolumes ?? {};
              const val = vols[id] ?? 100;
              return (
                <Control
                  className={SLIDER_CLASS}
                  key={id}
                  label={id}
                  onChange={(v) =>
                    onParamsChange({
                      instrumentVolumes: {
                        ...vols,
                        [id]: v,
                      },
                    })
                  }
                  sliderValue={[val]}
                  value={`${Math.round(val)}%`}
                />
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function Control({
  label,
  value,
  onChange,
  sliderValue,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: number) => void;
  sliderValue: number[];
  className?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2 font-comfortaa font-light text-[13px] text-white/70 lowercase tracking-wide">
        <span className="truncate">{label}</span>
        <span className="shrink-0 whitespace-nowrap">{value}</span>
      </div>
      <Slider
        className={className}
        max={100}
        min={0}
        onValueChange={(v) => onChange(v[0] ?? 0)}
        step={1}
        value={sliderValue}
      />
    </div>
  );
}
