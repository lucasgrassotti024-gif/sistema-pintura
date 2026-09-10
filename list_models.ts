import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
const envFile = fs.readFileSync(".env.local", "utf-8");
envFile.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
});

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function listModels() {
  try {
    const res = await (ai as any).models.list();
    for await (const m of res) {
      console.log(`${m.name} | methods: ${m.supportedGenerationMethods?.join(",")}`);
    }
  } catch (err: any) {
    console.error("Erro listModels:", err?.message || err);
  }
}
listModels();
