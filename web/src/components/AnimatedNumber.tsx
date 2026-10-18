import { animate, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Tweens between values (Inter tabular figures). */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className = "",
  duration = 0.6,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const mv = useMotionValue(value);
  const [text, setText] = useState(() => format(value));
  const first = useRef(true);
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      mv.set(value);
      setText(fmt.current(value));
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setText(fmt.current(v)) });
    return () => controls.stop();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span className={`tnum ${className}`}>{text}</span>;
}
