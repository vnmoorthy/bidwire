/** Optional gavel "knock", synthesized with WebAudio. Off by default; toggled on the Auctioneer's desk. */
const KEY = "bidwire.gavelSound";

export function gavelSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setGavelSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function playGavel() {
  if (!gavelSoundOn()) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const t = ctx.currentTime;
    const knock = (at: number, gain: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(190, at);
      o.frequency.exponentialRampToValueAtTime(55, at + 0.12);
      g.gain.setValueAtTime(gain, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.2);
      const len = Math.floor(ctx.sampleRate * 0.025);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const n = ctx.createBufferSource();
      const ng = ctx.createGain();
      ng.gain.value = gain * 0.6;
      n.buffer = buf;
      n.connect(ng).connect(ctx.destination);
      n.start(at);
    };
    knock(t, 0.9);
    window.setTimeout(() => ctx.close(), 500);
  } catch {
    /* audio unavailable */
  }
}
