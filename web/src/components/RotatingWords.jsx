import { useEffect, useState } from "react";

// Cycles a headline word in place: the current word leaves upward as the next rises in.
// Every word shares one grid cell, so the line never changes width. Screen readers and
// visitors who prefer reduced motion only ever get the first word. Pauses in background tabs.
export function RotatingWords({ words, interval = 2800 }) {
  const [state, setState] = useState({ active: 0, leaving: -1 });

  useEffect(() => {
    if (words.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let timer;
    const tick = () => setState(({ active }) => ({ active: (active + 1) % words.length, leaving: active }));
    const start = () => { clearInterval(timer); timer = setInterval(tick, interval); };
    const onVisibility = () => (document.hidden ? clearInterval(timer) : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [words.length, interval]);

  return <span className="rotating-words">
    {words.map((word, i) => <span
      key={word}
      className={i === state.active ? "is-active" : i === state.leaving ? "is-leaving" : undefined}
      aria-hidden={i === 0 ? undefined : true}
    >{word}</span>)}
  </span>;
}
