import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { currentText, feedback } = await req.json();

    if (!currentText || !feedback) {
      return NextResponse.json({ error: 'Missing currentText or feedback' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

    const result = await model.generateContent(prompt);
    let revisedText = result.response.text();

    // Safety strip of any markdown just in case
    revisedText = revisedText.replace(/\*\*/g, '').replace(/\*/g, '').trim();

    return NextResponse.json({ revisedText });

  } catch (error: any) {
    console.error('Refine API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to refine content' },
      { status: 500 }
    );
  }
}
