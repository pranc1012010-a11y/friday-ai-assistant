import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const targetLanguage = targetLang === 'ar' ? 'Arabic (Egyptian dialect preferred)' : 'English';

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a precise translator. Translate the following text to ${targetLanguage}. Only output the translation, nothing else. No explanations, no quotes, no extra text. Just the translated text.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
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
