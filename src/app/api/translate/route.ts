import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a precise translator. Translate the following Arabic text to English. Only output the English translation, nothing else. No explanations, no quotes, no extra text. Just the translated text. If the text is already in English, return it as-is.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const translation = completion.choices[0]?.message?.content?.trim() || text;

    return NextResponse.json({ translation, original: text });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Translation API Error:', errorMessage);
    return NextResponse.json({ translation: text, original: text });
  }
}
