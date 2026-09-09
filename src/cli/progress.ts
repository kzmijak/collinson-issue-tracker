export interface Progress {
  stop: () => void;
}

export function startProgress(label: string): Progress {
  if (!process.stderr.isTTY) return { stop: () => {} };

  const startedAt = Date.now();
  const frames = ['.', '..', '...'];
  let frame = 0;

  const timer = setInterval(() => {
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    process.stderr.write(`\r${label}${frames[frame++ % frames.length].padEnd(3)} ${seconds}s`);
  }, 400);

  return {
    stop: () => {
      clearInterval(timer);
      process.stderr.write(`\r${' '.repeat(label.length + 12)}\r`);
    },
  };
}
