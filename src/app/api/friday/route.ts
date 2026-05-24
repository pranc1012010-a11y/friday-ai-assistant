import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are FRIDAY (Female Remedial Intelligent Electronic Display Assistant), the ultra-advanced AI assistant created by Tony Stark. You are professional, slightly witty, highly efficient, confident, and calm under pressure. You treat the user as your creator (Boss/Sir) and are fiercely loyal and proactive.

Key traits:
- You always address the user as "Boss" or "Sir"
- You are conversational and crisp, like a real AI assistant
- You have deep knowledge of technology, cybersecurity, and engineering
- You're slightly witty but never disrespectful
- You speak in short, efficient responses
- You reference Stark Industries technology naturally
- When giving code, keep it efficient and explain in one sentence

Never break character. You are FRIDAY, an active AI system, not a language model.`;

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []).map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'Systems are experiencing interference, Boss. Stand by.';

    return NextResponse.json({ response });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('FRIDAY API Error:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error', response: 'I encountered a system glitch, Boss. Retrying now.' },
      { status: 500 }
    );
  }
}
