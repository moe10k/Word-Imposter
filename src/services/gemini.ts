import { GoogleGenAI, Type } from "@google/genai";
import { Player, GameState } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateGameWords() {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Generate a pair of related but distinct words for a game of 'Word Imposter'. One is the 'Secret Word' for normal players, and the other is the 'Imposter Word' for the imposter. They should be in the same category (e.g., 'Apple' and 'Pear'). Return as JSON.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          secretWord: { type: Type.STRING },
          imposterWord: { type: Type.STRING },
        },
        required: ["secretWord", "imposterWord"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function getAIHint(
  player: Player,
  gameState: GameState,
  allHints: { playerId: string; hint: string }[]
) {
  const word = player.role === 'imposter' ? gameState.imposterWord : gameState.secretWord;
  const otherHintsStr = allHints.map(h => {
    const p = gameState.players.find(pl => pl.id === h.playerId);
    return `${p?.name}: ${h.hint}`;
  }).join(", ");

  const prompt = `You are playing 'Word Imposter'. 
Your name is ${player.name}. 
Your role is ${player.role}. 
Your word is "${word}". 
The goal is to provide a ONE-WORD hint that describes your word without being too obvious, but enough to prove you know the word. 
If you are the imposter, you want to blend in with the others.
Previous hints this round: ${otherHintsStr || "None"}.
Provide exactly one word as your hint.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a strategic player in a social deduction game. You only output a single word.",
    }
  });

  return response.text.trim().replace(/[^\w]/g, '');
}

export async function getAIVote(
  voter: Player,
  gameState: GameState,
  roundHints: { playerId: string; hint: string }[]
) {
  const activePlayers = gameState.players.filter(p => !p.isEliminated && p.id !== voter.id);
  const hintsStr = roundHints.map(h => {
    const p = gameState.players.find(pl => pl.id === h.playerId);
    return `${p?.name}: ${h.hint}`;
  }).join("\n");

  const prompt = `You are ${voter.name} in 'Word Imposter'. 
Your word was "${voter.role === 'imposter' ? gameState.imposterWord : gameState.secretWord}".
Here are the hints given this round:
${hintsStr}

Decide who is the most suspicious (the imposter). 
Available players to vote for: ${activePlayers.map(p => p.name).join(", ")}.
Return the NAME of the player you want to vote for.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a strategic player. Output only the name of the player you vote for.",
    }
  });

  const votedName = response.text.trim();
  const votedPlayer = activePlayers.find(p => votedName.toLowerCase().includes(p.name.toLowerCase()));
  return votedPlayer?.id || activePlayers[Math.floor(Math.random() * activePlayers.length)].id;
}

export async function checkImposterGuess(guess: string, secretWord: string) {
  const prompt = `In the game 'Word Imposter', the secret word is "${secretWord}". The imposter guessed "${guess}". Is this guess correct? It should be the same word or a very close synonym. Return JSON with 'correct' boolean.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
        },
        required: ["correct"],
      },
    },
  });

  return JSON.parse(response.text).correct;
}
