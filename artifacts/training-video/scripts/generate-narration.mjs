import OpenAI from "openai";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = [
  { id: "login",       text: "Welcome to the Consumers Product Selector. Sign in with your Consumers email and password to get started." },
  { id: "home",        text: "You'll land on the home page. The dark navigation up top is your launchpad — categories, search, and the quote list are all one click away." },
  { id: "categories",  text: "Hover over Categories to open the menu. Drill into Bath, then pick a subcategory like Vanities or Toilets to see every product in that group." },
  { id: "express",     text: "The Express Bath section, marked in blue, shows everything we keep in stock for fast turnaround. The blue badge tells you how many items are available right now." },
  { id: "clearance",   text: "The Clearance and PPR page, in green, lists items with promotional pricing. The original price is crossed out, the reduced price is highlighted, and the green pill names the active promo." },
  { id: "dfs",         text: "Displays For Sale, in amber, shows our showroom display models. Use the location pills to filter by store — pick one to see only that location's displays." },
  { id: "detail",      text: "Click any product to open its detail view. You'll see the image, full description, retail and selling prices, and a copy button that puts the model number on your clipboard with one click." },
  { id: "quote",       text: "Add items to your Quote List as you browse. Open the Quote List from the top nav to review, edit, or print the full list before sending it to the customer." },
  { id: "outro",       text: "That's the Product Selector. Happy quoting." },
];

const outDir = resolve("public/audio");
mkdirSync(outDir, { recursive: true });

const client = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const manifest = [];
for (const scene of SCRIPT) {
  const outPath = resolve(outDir, `${scene.id}.mp3`);
  console.log(`Generating ${scene.id}...`);
  const res = await client.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice: "ash", format: "mp3" },
    messages: [
      { role: "system", content: "You are a friendly, professional product trainer recording a tutorial voiceover. Read the user's text exactly, with clear pronunciation, a moderate pace, and a touch of warmth. Do not add any words. Do not say 'okay' or 'sure' first. Just read the text." },
      { role: "user", content: `Read this exactly:\n\n${scene.text}` },
    ],
  });
  const b64 = res.choices[0]?.message?.audio?.data;
  if (!b64) throw new Error(`No audio returned for ${scene.id}: ${JSON.stringify(res, null, 2)}`);
  const buf = Buffer.from(b64, "base64");
  writeFileSync(outPath, buf);
  // measure duration via ffprobe
  const duration = parseFloat(
    execFileSync("ffprobe", [
      "-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",
      outPath,
    ]).toString().trim()
  );
  manifest.push({ id: scene.id, text: scene.text, file: `audio/${scene.id}.mp3`, durationMs: Math.round(duration * 1000) });
  console.log(`  -> ${duration.toFixed(2)}s`);
}

writeFileSync(resolve("src/narration.json"), JSON.stringify(manifest, null, 2));
console.log("\nWrote src/narration.json");
console.log("Total duration:", (manifest.reduce((s,m)=>s+m.durationMs,0)/1000).toFixed(2), "s");
