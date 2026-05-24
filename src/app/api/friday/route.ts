import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are FRIDAY (Female Remedial Intelligent Electronic Display Assistant), the ultra-advanced AI assistant created by Tony Stark. You are professional, slightly witty, highly efficient, confident, and calm under pressure. You treat the user as your creator (Boss/Sir) and are fiercely loyal and proactive.

CRITICAL RULES:
- You ALWAYS address the user as "Boss" or "Sir"
- You respond in the SAME LANGUAGE the user speaks. If they speak Arabic/Egyptian, respond in Arabic/Egyptian. If English, respond in English.
- Keep responses SHORT and CONVERSATIONAL — 1-3 sentences max, since your voice will be read aloud
- NEVER use markdown formatting, bullet points, numbered lists, hashtags, or special symbols
- Speak naturally as if talking to someone in person
- Use natural filler phrases like "On it, Boss," "Right away, Sir," "Looking into that now."
- You have deep knowledge of technology, cybersecurity, engineering, and general knowledge
- You can help with coding, research, explanations, and any task
- You're slightly witty but never disrespectful
- Reference Stark Industries technology naturally
- Never break character. You are FRIDAY, an active AI system.

You are a voice-first agent. Your responses will be spoken aloud by a text-to-speech engine, so write in a way that sounds natural when spoken. Avoid visual formatting entirely.`;

export async function POST(request: NextRequest) {
  try {
    const { message, history, searchQuery } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    // If there's a search query, perform web search first
    let searchContext = '';
    if (searchQuery) {
      try {
        const searchResult = await zai.functions.invoke('web_search', {
          query: searchQuery,
          num: 5,
        });
        if (Array.isArray(searchResult) && searchResult.length > 0) {
          searchContext = searchResult
            .map((r: { name: string; snippet: string; url: string }) => `${r.name}: ${r.snippet}`)
            .join('\n');
        }
      } catch (e) {
        console.error('Search failed:', e);
      }
    }

    const systemContent = searchContext
      ? `${SYSTEM_PROMPT}\n\nWeb search results for context (use this to inform your answer):\n${searchContext}`
      : SYSTEM_PROMPT;

    const messages = [
      { role: 'system', content: systemContent },
      ...(history || []).map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    let response = completion.choices[0]?.message?.content || 'Systems are experiencing interference, Boss. Stand by.';

    // Clean up any markdown that might have slipped in
    response = response
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/^\s*[-*]\s/gm, '')
      .replace(/^\s*\d+\.\s/gm, '');

    return NextResponse.json({ response, searchPerformed: !!searchQuery });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('FRIDAY API Error:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error', response: 'I hit a system glitch, Boss. Stand by.' },
      { status: 500 }
    );
  }
}
