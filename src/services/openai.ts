import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import type { Player, GameState } from "../types";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set. Add it to your environment before starting the server.");
}

const openai = new OpenAI({ apiKey });
const defaultModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-nano";
const wordMaxTokens = Number(process.env.OPENAI_WORD_MAX_TOKENS ?? 48);
const hintMaxTokens = Number(process.env.OPENAI_HINT_MAX_TOKENS ?? 8);
const voteMaxTokens = Number(process.env.OPENAI_VOTE_MAX_TOKENS ?? 8);
const guessMaxTokens = Number(process.env.OPENAI_GUESS_MAX_TOKENS ?? 8);

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
  params: Parameters<typeof openai.responses.create>[0],
  context: string
): Promise<Response> => {
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
        input:
          "Return JSON {\"secretWord\":\"\",\"imposterWord\":\"\"} for two related everyday nouns used in Word Imposter. The imposter word should be closely related to the secret word, but not so similar that the imposter can easily infer the secret word.",
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

export async function checkImposterGuess(guess: string, secretWord: string) {
  if (!guess.trim()) return false;

  if (guess.trim().toLowerCase() === secretWord.trim().toLowerCase()) {
    return true;
  }

  try {
    const response = await createResponse(
      {
        model: defaultModel,
        input: `Secret word "${secretWord}". Guess "${guess}". Respond JSON {"correct": true|false} if the guess is the same word or a close synonym.`,
        max_output_tokens: guessMaxTokens,
      },
      "checkImposterGuess"
    );

    const text = extractText(response);
    if (!text) throw new Error("OpenAI returned an empty response for the guess check.");
    return parseJson<{ correct: boolean }>(text, "imposter guess check").correct;
  } catch (error) {
    console.error("OpenAI checkImposterGuess failed; defaulting to simple match.", error);
    return guess.trim().toLowerCase() === secretWord.trim().toLowerCase();
  }
}
