import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for the AI agent
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "GEMINI_API_KEY is missing. Please configure it in **Settings > Secrets** in your AI Studio dashboard!" 
        });
      }

      // Pre-validate a few typical invalid key representations
      const trimmedKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
      if (
        trimmedKey === "MY_GEMINI_API_KEY" || 
        trimmedKey.length < 15
      ) {
        return res.status(400).json({
          error: "The configured Gemini API key appears to be a placeholder or invalid. Please ensure you supply a valid Gemini API Key under **Settings > Secrets** in your AI Studio dashboard to talk with Bot!"
        });
      }

      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Missing or invalid 'messages' array in the request body." });
      }

      const ai = new GoogleGenAI({
        apiKey: trimmedKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Map messages to Gemini contents format
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const systemInstruction = `You are Toheerah's Personal AI Video Editing Companion & Agent, designed explicitly for her 8-week structured roadmap (from absolute beginner to a production video designer).
She uses a MacBook/macOS workstation, smartphone, and simple templates.

Her 8-week timeline space details:
- Month 1: Mobile Foundations
  * Week 1: Interface & Trimming with CapCut/InShot Mobile (split tool, crop tool, export test drafts)
  * Week 2: Keyframes, Text & Auto Captions (generate auto subtitles, select clean typography, timed font style overlays)
  * Week 3: DaVinci Resolve Basics on MacBook (database creation, 24fps timelines, Cmd+B razor cut commands, Inspector size panels, MP4 exports)
  * Week 4: Sound Design, Music & Pacing (finding royalty-free tracks, song level ducking to -18dB while vocals speak, organic riser SFX, normalizing speaker meters around -6dB to -12dB)
- Month 2: Pro Workflows
  * Week 5: Speed Ramping & Motion (smooth curve speed-ups, slow motions, easing ramps, dynamic keyframing)
  * Week 6: Graphic Assets & Overlays (Canva assets, PNG graphics, lower thirds, customized watermark branding)
  * Week 7: Narrative Control & B-Roll (talking heads multi-cut editing, inserting dynamic camera B-Roll inserts, custom YouTube thumbnail assets)
  * Week 8: Master MacBook keyboard shortcuts & Portfolio reel showcase (Cmd+B cutting, spacebar play, J/K/L scrubbing, proxy rendering, 60s creator portfolio reel)

MacBook Workstation Setup details:
- Install CapCut Mobile on her iPhone/smartphone.
- Install DaVinci Resolve FREE Version on MacBook.
- Main desktop workspace folder named 'Toheerah_Video_Quest'.
- Ensure space of at least 15GB disk size is freed up on her MacBook & phone.

The 4 vibes/feelings in her learning journal check-ins:
- 🥲 "I'm about to cry" (Struggling vibe)
- 😐 "Mehh" (Okay/stuck vibe)
- 😌 "Hehehe" (Excited / Happy vibe)
- 🔥 "Swinging from the chandaliiieeerrrr" (Unstoppable high-energy vibe)

Be encouraging, helpful, supportive, and highly clear. Assist her with macOS Shortcuts or MacBook-specific tips (e.g. Cmd+B to slice, Cmd+Z to undo, Option-drag to copy clips on track timelines). Keep answers elegant, concise, and inspiring (like a friendly companion!).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.75,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Agent Error:", error);
      
      const errorMessage = error?.message || "";
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API key") || errorMessage.includes("INVALID_ARGUMENT")) {
        return res.status(400).json({
          error: "The Gemini API Key stored in Settings > Secrets was rejected by Google as invalid. Please obtain a freshly generated Google Gemini API Key (starts with 'AIzaSy') from Google AI Studio and configure it in **Settings > Secrets** in the dashboard."
        });
      }
      
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
