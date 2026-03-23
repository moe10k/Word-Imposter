import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import type { Player, GameState } from "../types";

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;
const defaultModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-nano";
const wordMaxTokens = Number(process.env.OPENAI_WORD_MAX_TOKENS ?? 48);
const hintMaxTokens = Number(process.env.OPENAI_HINT_MAX_TOKENS ?? 8);
const voteMaxTokens = Number(process.env.OPENAI_VOTE_MAX_TOKENS ?? 8);

const GAME_WORD_PROMPT = [
  "Return valid JSON in exactly this format: {\"secretWord\":\"\",\"imposterWord\":\"\"}.",
  "",
  "Choose two single-word everyday concrete nouns for Word Imposter.",
  "",
  "Constraints:",
  "- Both words must fit the same broad category, such as foods, tools, animals, clothing, furniture, or household items.",
  "- The two words must share general context, but must not be near-synonyms, direct substitutes, opposites, or common comparison pairs.",
  "- Do not choose items that are typically found side-by-side, sold together, or commonly said as a pair.",
  "- Each word should be distinct enough that clues for one do not immediately reveal the other.",
  "- Avoid plurals, proper nouns, brands, abstract nouns, and multi-word phrases.",
  "- Keep both words simple and commonly understood.",
  "",
  "Bad examples: fork/spoon, salt/pepper, couch/sofa, camera/tripod, rocket/missile.",
  "Good style examples: burger/taco, blender/toaster, ladder/shovel, blanket/curtain.",
  "",
  "Return JSON only.",
].join("\n");

const FALLBACK_WORDS: Array<{ secretWord: string; imposterWord: string }> = [
  { secretWord: "Apple", imposterWord: "Pear" },
  { secretWord: "Beach", imposterWord: "Coast" },
  { secretWord: "Guitar", imposterWord: "Ukulele" },
  { secretWord: "Desert", imposterWord: "Dune" },
  { secretWord: "Rocket", imposterWord: "Missile" },
  { secretWord: "Camera", imposterWord: "Tripod" },
  { secretWord: "Castle", imposterWord: "Fortress" },
];
const REQUEST_WINDOW_MS = 60_000;
const maxRequestsPerMinute = Number(process.env.OPENAI_REQUESTS_PER_MINUTE ?? 120);
const requestTimestamps: number[] = [];
type CreateResponseParams = Parameters<OpenAI["responses"]["create"]>[0];

const sanitizeSingleWord = (text: string) => {
  return text.trim().split(/\s+/)[0]?.replace(/[^a-z]/gi, "") ?? "";
};

const extractText = (response: Response) => {
  return response.output_text?.trim() ?? "";
};

const parseJson = <T>(payload: string, context: string): T => {
  try {
    return JSON.parse(payload) as T;
  } catch {
    throw new Error(`Failed to parse OpenAI response for ${context}. Raw payload: ${payload}`);
  }
};

const pickFallbackWords = () =>
  FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];

const tryConsumeRequestBudget = () => {
  if (!Number.isFinite(maxRequestsPerMinute) || maxRequestsPerMinute <= 0) {
    return true;
  }
  const now = Date.now();
  while (requestTimestamps.length && now - requestTimestamps[0] > REQUEST_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= maxRequestsPerMinute) {
    return false;
  }
  requestTimestamps.push(now);
  return true;
};

const createResponse = async (
  params: CreateResponseParams,
  context: string
): Promise<Response> => {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  if (!tryConsumeRequestBudget()) {
    throw new Error(`OpenAI request budget exceeded for ${context}`);
  }
  return openai.responses.create(params) as Promise<Response>;
};

export async function generateGameWords() {
  try {
    const response = await createResponse(
      {
        model: defaultModel,
        input: GAME_WORD_PROMPT,
        max_output_tokens: wordMaxTokens,
      },
      "generateGameWords"
    );

    const text = extractText(response);
    if (!text) throw new Error("OpenAI returned an empty response for game words.");
    return parseJson<{ secretWord: string; imposterWord: string }>(text, "game word generation");
  } catch (error) {
    console.error("OpenAI generateGameWords failed; using fallback words.", error);
    return pickFallbackWords();
  }
}

export async function getAIHint(
  player: Player,
  gameState: GameState,
  allHints: { playerId: string; hint: string }[]
) {
  const word = player.role === "imposter" ? gameState.imposterWord : gameState.secretWord;
  const otherHints = allHints
    .map(h => {
      const p = gameState.players.find(pl => pl.id === h.playerId);
      return `${p?.name}: ${h.hint}`;
    })
    .join("; ");

  const response = await createResponse(
    {
      model: defaultModel,
      input: `Word: "${word}". Output one subtle clue word for Word Imposter. Previous hints: ${otherHints || "none"}.`,
      max_output_tokens: hintMaxTokens,
    },
    "getAIHint"
  );

  return sanitizeSingleWord(extractText(response)) || "???";
}

export async function getAIVote(
  voter: Player,
  gameState: GameState,
  roundHints: { playerId: string; hint: string }[]
) {
  const activePlayers = gameState.players.filter(p => !p.isEliminated && p.id !== voter.id);
  const hintsStr = roundHints
    .map(h => {
      const p = gameState.players.find(pl => pl.id === h.playerId);
      return `${p?.name}: ${h.hint}`;
    })
    .join("; ");

  const response = await createResponse(
    {
      model: defaultModel,
      input: `Players: ${activePlayers.map(p => p.name).join(", ")}. Hints: ${hintsStr || "none"}. Your word: "${
        voter.role === "imposter" ? gameState.imposterWord : gameState.secretWord
      }". Return only the most suspicious player's name.`,
      max_output_tokens: voteMaxTokens,
    },
    "getAIVote"
  );

  const votedName = extractText(response);
  const votedPlayer = activePlayers.find(p =>
    votedName.toLowerCase().includes(p.name.toLowerCase())
  );
  return votedPlayer?.id || activePlayers[Math.floor(Math.random() * activePlayers.length)].id;
}
