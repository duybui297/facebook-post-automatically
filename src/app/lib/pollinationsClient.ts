import { GoogleGenerativeAI } from '@google/generative-ai';

const TEXT_MODEL_FALLBACKS = [
  {
    label: 'gemini-1.5-flash',
    candidates: ['gemini-1.5-flash', 'gemini-1.5-flash-latest']
  },
  {
    label: 'gemini-2.0-flash',
    candidates: ['gemini-2.0-flash']
  },
  {
    label: 'gemini-2.5-flash',
    candidates: ['gemini-2.5-flash']
  }
] as const;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function callPollinationsText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastErrorMessage = 'Unknown Gemini error';

  for (const modelGroup of TEXT_MODEL_FALLBACKS) {
    try {
      for (const candidate of modelGroup.candidates) {
        try {
          const model = genAI.getGenerativeModel({ model: candidate });
          const result = await model.generateContent(prompt);
          const text = result.response.text().trim();

          if (!text) {
            throw new Error('Empty response');
          }

          console.log(`[Gemini Text] Success with ${candidate} (${modelGroup.label})`);
          return text;
        } catch (error) {
          lastErrorMessage = getErrorMessage(error);
          console.warn(`[Gemini Text] ${candidate} failed: ${lastErrorMessage}`);
        }
      }
    } catch (error) {
      lastErrorMessage = getErrorMessage(error);
      console.warn(`[Gemini Text] ${modelGroup.label} group failed: ${lastErrorMessage}`);
    }
  }

  throw new Error(`All Gemini fallback models failed. Last error: ${lastErrorMessage}`);
}
