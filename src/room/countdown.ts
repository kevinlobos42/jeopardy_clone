import { useEffect, useState } from "react";

/**
 * Whole seconds left until a server deadline (ms timestamp), ticking live.
 * Returns null when there's no deadline. Never below 0.
 */
export function useCountdown(deadline: number | null, clockOffset: number): number | null {
  const compute = () => (deadline === null ? null : Math.max(0, Math.ceil((deadline - (Date.now() + clockOffset)) / 1000)));
  const [left, setLeft] = useState(compute);

  useEffect(() => {
    setLeft(compute());
    if (deadline === null) return;
    const id = setInterval(() => setLeft(compute()), 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, clockOffset]);

  return left;
}

/** Fraction of time remaining (1 → 0) for progress bars. */
export function useTimeFraction(deadline: number | null, totalSeconds: number, clockOffset: number): number {
  const compute = () =>
    deadline === null ? 0 : Math.min(1, Math.max(0, (deadline - (Date.now() + clockOffset)) / (totalSeconds * 1000)));
  const [fraction, setFraction] = useState(compute);
  useEffect(() => {
    setFraction(compute());
    if (deadline === null) return;
    const id = setInterval(() => setFraction(compute()), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, totalSeconds, clockOffset]);
  return fraction;
}
