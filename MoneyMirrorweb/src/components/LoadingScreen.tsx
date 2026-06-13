import { useEffect, useState } from "react";

const STEPS = [
  "Analyzing transactions...",
  "Finding hidden expenses...",
  "Building your financial twin...",
  "Generating recommendations...",
];

interface LoadingScreenProps {
  /** Set to true when all API calls have completed. The bar will fast-finish and call onDone. */
  isComplete?: boolean;
  onDone: () => void;
}

export function LoadingScreen({ isComplete, onDone }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  // Phase 1: run timer-based progress up to 90% and stop, waiting for isComplete.
  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) {
          clearInterval(t);
          return p;
        }
        return p + 1.2;
      });
    }, 40);
    return () => clearInterval(t);
  }, []); // runs once on mount

  // Phase 2: when API is done, instantly jump to 100% and dismiss.
  useEffect(() => {
    if (!isComplete) return;
    setProgress(100);
    const t = setTimeout(onDone, 400);
    return () => clearTimeout(t);
  }, [isComplete, onDone]);

  useEffect(() => {
    setStepIdx(Math.min(STEPS.length - 1, Math.floor(progress / 25)));
  }, [progress]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
            <div className="absolute inset-2 rounded-full bg-gradient-accent shadow-glow" />
            <div className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-primary-foreground">
              {Math.round(progress)}%
            </div>
          </div>
        </div>
        <h2 className="text-center font-display text-2xl font-bold tracking-tight">Crunching the numbers</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">Our AI is reading your financial fingerprint.</p>
        <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-accent transition-all"
            style={{ width: `${progress}%`, transitionDuration: progress === 100 ? "300ms" : "100ms" }}
          />
        </div>
        <ul className="mt-8 space-y-3">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`flex items-center gap-3 text-sm transition-all ${
                i < stepIdx ? "text-foreground" : i === stepIdx ? "font-medium text-foreground" : "text-muted-foreground/60"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  i < stepIdx ? "bg-success text-success-foreground" : i === stepIdx ? "bg-foreground text-background" : "bg-muted"
                }`}
              >
                {i < stepIdx ? "✓" : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
