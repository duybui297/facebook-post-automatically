import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: any = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      console.log(`[refine] Used model: ${modelName}`);
      return result.response.text();
    } catch (err: any) {
      lastError = err;
      const is429 = err?.message?.includes('429') || err?.status === 429;
      if (is429) {
        console.warn(`[refine] ${modelName} quota exceeded, trying next model...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('All Gemini models quota exceeded.');
}

export async function POST(req: Request) {
  try {
    const { currentText, feedback } = await req.json();

    if (!currentText || !feedback) {
      return NextResponse.json({ error: 'Missing currentText or feedback' }, { status: 400 });
    }

    const prompt = `
    You are an expert social media content editor for Facebook.
    
    The user has a Facebook post draft and wants to improve it based on their feedback.
    
    CURRENT POST TEXT:
    ---
    ${currentText}
    ---
    
    USER FEEDBACK / REVISION REQUEST:
    "${feedback}"
    
    INSTRUCTIONS:
    - Carefully apply the user's feedback to revise the post.
    - Keep the overall message and emojis if they are good.
    - DO NOT use any Markdown formatting like **bold** or *italic*. Facebook does not support Markdown.
    - Output strictly plain text with emojis only.
    - Return ONLY the revised post text, nothing else. No commentary, no preamble.
    `;

    let revisedText = await generateWithFallback(prompt);
    revisedText = revisedText.replace(/\*\*/g, '').replace(/\*/g, '').trim();

    return NextResponse.json({ revisedText });

  } catch (error: any) {
    console.error('Refine API Error:', error);
    const isQuota = error?.message?.includes('429') || error?.message?.includes('quota');
    return NextResponse.json(
      { error: isQuota ? 'AI quota exceeded. Please wait a few minutes and try again.' : (error?.message || 'Failed to refine content') },
      { status: 500 }
    );
  }
}
