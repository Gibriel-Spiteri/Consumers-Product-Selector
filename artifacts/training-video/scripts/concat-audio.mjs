import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("src/narration.json"), "utf8"));
const PAD_MS = 700;
const TAIL_MS = 800;

mkdirSync(resolve("public/audio"), { recursive: true });
const tmpDir = resolve("public/audio/_tmp");
mkdirSync(tmpDir, { recursive: true });

// Build a list file for concat: [scene1.mp3, silence.mp3, scene2.mp3, silence.mp3, ..., sceneN.mp3, silence_tail.mp3]
const padPath = resolve(tmpDir, "pad.mp3");
const tailPath = resolve(tmpDir, "tail.mp3");
execFileSync("ffmpeg", ["-y","-f","lavfi","-i",`anullsrc=r=24000:cl=mono`,"-t",`${PAD_MS/1000}`,"-q:a","9","-acodec","libmp3lame", padPath], { stdio: "ignore" });
execFileSync("ffmpeg", ["-y","-f","lavfi","-i",`anullsrc=r=24000:cl=mono`,"-t",`${TAIL_MS/1000}`,"-q:a","9","-acodec","libmp3lame", tailPath], { stdio: "ignore" });

const listPath = resolve(tmpDir, "list.txt");
const lines = [];
const segments = [];
let cursorMs = 0;
for (let i = 0; i < manifest.length; i++) {
  const m = manifest[i];
  const audioPath = resolve("public", m.file);
  lines.push(`file '${audioPath.replace(/'/g, "'\\''")}'`);
  const startMs = cursorMs;
  cursorMs += m.durationMs;
  const endMs = cursorMs;
  // pad after every scene except last
  if (i < manifest.length - 1) {
    lines.push(`file '${padPath.replace(/'/g, "'\\''")}'`);
    cursorMs += PAD_MS;
  } else {
    lines.push(`file '${tailPath.replace(/'/g, "'\\''")}'`);
    cursorMs += TAIL_MS;
  }
  segments.push({
    id: m.id,
    text: m.text,
    audioStartMs: startMs,
    audioEndMs: endMs,
    sceneDurationMs: (i < manifest.length - 1 ? m.durationMs + PAD_MS : m.durationMs + TAIL_MS),
  });
}
writeFileSync(listPath, lines.join("\n"));

const outPath = resolve("public/audio/voiceover.mp3");
execFileSync("ffmpeg", ["-y","-f","concat","-safe","0","-i",listPath,"-c","copy", outPath], { stdio: "inherit" });

writeFileSync(resolve("src/narration.json"), JSON.stringify({
  audioFile: "audio/voiceover.mp3",
  totalDurationMs: cursorMs,
  scenes: segments,
}, null, 2));

console.log(`Concatenated → ${outPath}`);
console.log(`Total: ${(cursorMs/1000).toFixed(2)}s`);
console.log("Per-scene durations:", segments.map(s => `${s.id}=${(s.sceneDurationMs/1000).toFixed(2)}s`).join(", "));
