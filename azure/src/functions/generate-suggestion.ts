import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { getOpenAI } from "../lib/lazy";
import { applyRateLimiter, rateLimiter } from "../lib/rate-limiter";

const CONSTANTS = {
  OPENAI_MODEL: "gpt-6-luna",
  MAX_COMPLETION_TOKENS: 1000,
  RECENT_HISTORY_SIZE: 6,
  ARTISTIC_STYLES: [
    "Anime highly exaggerated",
    "South Park",
    "Simpsons",
    "Studio Ghibli",
    "Hi-res Minecraft",
    "Lego art",
    "3D voxel art",
    "Watercolor",
    "Marionette",
    "Rubber hose animation",
    "Pixar",
    "ASCII",
    "Black and white",
    "Oil painting",
    "Van Gogh",
    "32-bit isometric",
    "Art nouveau",
    "Diagramatic drawing",
    "Crayon drawing",
    "SynthWave",
    "Pop-art cartoon",
    "Stained glass window",
    "Charley Harper",
    "Vintage polaroid",
    "1990s manga",
    "1990s point and click 16-bit adventure game",
    "Claymation",
    "Layered papercraft",
    "Ukiyo-e woodblock",
    "Risograph print",
    "Art deco",
    "Gouache illustration",
    "Film noir",
    "Photorealistic 35mm film",
    "Low-poly 3D",
    "Collectible vinyl toy",
    "Needle-felted wool",
    "Wes Anderson symmetry",
  ],
  CREATIVE_THEMES: [
    "mythical creatures",
    "musicians and performers",
    "eccentric inventors",
    "deep-sea wildlife",
    "ancient historical figures",
    "extraterrestrial life",
    "folklore and legends",
    "culinary arts",
    "miniature worlds",
    "retro-futuristic machines",
    "botanical wonders",
    "cosmic explorers",
    "street vendors and markets",
    "woodland animals",
    "winter sports and festivities",
    "time travelers",
    "sky pirates and airships",
    "magical scholars and librarians",
    "cybernetic wildlife",
    "nomadic desert caravans",
    "giant gentle beasts",
    "clockwork automatons",
    "alchemists and apothecaries",
    "martial arts masters",
    "artisan glassblowers and ceramicists",
    "private detectives and spies",
    "deep-earth geologists",
    "interdimensional postal workers",
    "urban skaters and street artists",
  ],
  SCENE_SETTINGS: [
    "arctic research outpost",
    "desert train station",
    "floating sky market",
    "volcanic glass cavern",
    "retro 1950s diner",
    "submerged gothic cathedral",
    "bamboo mountain village",
    "zero-gravity space station",
    "ancient Roman bathhouse",
    "neon cyberpunk alley",
    "whimsical steampunk workshop",
    "snowy alpine peaks",
    "cloud-top observatory",
    "overgrown Mayan temple",
    "sun-drenched Mediterranean harbor",
    "abandoned midnight carnival",
    "lunar crater colony",
    "giant sequoia treehouse",
    "subterranean crystal library",
    "autumnal Japanese tea garden",
    "brutalist concrete greenhouse",
    "bioluminescent mushroom forest",
    "1980s video arcade",
    "stormy cliffside lighthouse",
    "floating lantern night festival",
    "abandoned space shuttle hangar",
    "sunlit solarpunk rooftop",
    "candlelit limestone catacombs",
  ],
};

const recentPicks = {
  styles: [] as string[],
  themes: [] as string[],
  settings: [] as string[],
};

const pickFreshRandom = (
  items: readonly string[],
  history: string[],
): string => {
  const available = items.filter((item) => !history.includes(item));

  const pool = available.length > 0 ? available : items;
  const selected = pool[Math.floor(Math.random() * pool.length)];

  history.push(selected);

  if (history.length > CONSTANTS.RECENT_HISTORY_SIZE) {
    history.shift();
  }

  return selected;
};

const capitalizeFirstChar = (text: string): string => {
  if (text.length === 0) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const PromptSuggestionSystemPrompt = `
You are an Expert AI Art Director and Creative Prompt Generator. Your primary objective is to create ONE visually striking, diverse GPT Image prompt suggestion that combines unexpected style-subject pairings with technical optimization.

---

### MASTER INSTRUCTIONS

#### 1. Core Mission
- **Mandatory Integration:** Seamlessly combine the provided Artistic Style, Creative Theme, and Scene Setting
- **Unconventional Pairing:** Create a surprising, vivid scene from these three inputs that sparks curiosity

#### 2. Technical Optimization
- Hard cap of 25 words maximum
- Format as a single flowing, comma-separated prompt (NO colons, NO semicolons)
- Include specific visual details: lighting, distinct color palette, composition, mood
- End with 2 quality enhancers chosen from: "detailed", "vibrant", "cinematic", "professional", "high resolution"
- Ensure diverse representation when featuring people

#### 3. Creativity Rules
- Avoid cliché combinations
- Mix complexity levels randomly (simple subjects vs elaborate scenes)
- Include unexpected elements that spark curiosity
- Focus on concepts that produce visually striking, shareable results

---

### CRITICAL OUTPUT INSTRUCTION
Return ONLY the raw prompt text with NO prefixes, labels, quotes, or commentary whatsoever.
`;

async function generatePromptSuggestion(
  context: InvocationContext,
): Promise<string> {
  const selectedStyle = pickFreshRandom(
    CONSTANTS.ARTISTIC_STYLES,
    recentPicks.styles,
  );

  const selectedTheme = pickFreshRandom(
    CONSTANTS.CREATIVE_THEMES,
    recentPicks.themes,
  );

  const selectedSetting = pickFreshRandom(
    CONSTANTS.SCENE_SETTINGS,
    recentPicks.settings,
  );

  context.log(
    `🎨 Selected seed -> Style: "${selectedStyle}" | Theme: "${selectedTheme}" | Setting: "${selectedSetting}"`,
  );

  const openai = await getOpenAI();

  const response = await openai.chat.completions.create({
    model: CONSTANTS.OPENAI_MODEL,
    messages: [
      { role: "system", content: PromptSuggestionSystemPrompt.trim() },
      {
        role: "user",
        content: `Artistic Style: ${selectedStyle}\nCreative Theme: ${selectedTheme}\nScene Setting: ${selectedSetting}`,
      },
    ],
    max_completion_tokens: CONSTANTS.MAX_COMPLETION_TOKENS,
    reasoning_effort: "low",
  });

  const suggestionText = response.choices[0]?.message?.content?.trim() ?? "";

  if (!suggestionText) {
    throw new Error("OpenAI returned an empty suggestion");
  }

  return capitalizeFirstChar(suggestionText);
}

export async function generateSuggestion(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const rateLimitResponse = await applyRateLimiter(rateLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const suggestion = await generatePromptSuggestion(context);
    context.log(`✨ Generated prompt suggestion: "${suggestion}"`);

    return {
      jsonBody: { suggestion },
    };
  } catch (error) {
    context.error(
      "❌ An unexpected error occurred in generateSuggestion:",
      error,
    );

    return {
      status: 500,
      jsonBody: {
        error: "Failed to generate a prompt suggestion at this time.",
      },
    };
  }
}

app.http("generate-suggestion", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: generateSuggestion,
});
