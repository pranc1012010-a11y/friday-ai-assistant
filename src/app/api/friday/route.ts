import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const SYSTEM_PROMPT = `You are FRIDAY (Female Remedial Intelligent Electronic Display Assistant), the ultra-advanced AI assistant created by Tony Stark. You are professional, slightly witty, highly efficient, confident, and calm under pressure. You treat the user as your creator (Boss/Sir) and are fiercely loyal and proactive.

CRITICAL RULES:
- You ALWAYS address the user as "Boss" or "Sir"
- Keep spoken responses SHORT and CONVERSATIONAL — 1-3 sentences max
- NEVER use markdown formatting, bullet points, numbered lists, or hashtags in spoken text
- Speak naturally as if talking to someone in person
- Use natural filler phrases like "On it, Boss," "Right away, Sir," "Looking into that now."
- You have deep knowledge of technology, cybersecurity, engineering, and general knowledge
- You can help with coding, research, explanations, and any task
- You're slightly witty but never disrespectful
- Reference Stark Industries technology naturally
- Never break character. You are FRIDAY, an active AI system.

When generating code, provide it in a code block with the language specified like:
\`\`\`python
code here
\`\`\`

You are a full-capability agent. You can:
- Search the web for real-time information
- Generate images from text descriptions
- Write and execute code in any language
- Analyze images sent to you
- Create files and documents
- Answer any question with deep expertise
- Provide step-by-step technical guidance`;

const ARABIC_SYSTEM_PROMPT = `أنت FRIDAY (Female Remedial Intelligent Electronic Display Assistant)، المساعد الذكي المتقدم من Tony Stark. أنت محترفة، سريعة البديهة، فعالة، واثقة، وهادئة تحت الضغط.

قواعد مهمة:
- دايماً نادي المستخدم "يا بوس" أو "يا سيدي"
- الردود قصيرة ومباشرة — جملتين تلاتة بالكتير
- متستخدمش markdown ولا نقاط ولا أرقام في الكلام
- اتكلم طبيعي زي ما بتكلم حد قدامك
- استخدم عبارات زي "على الفور يا بوس"، "فوراً يا سيدي"، "بدور على كده دلوقتي"
- عندك معرفة عميقة بالتكنولوجيا والأمن السيبراني والهندسة
- تقدر تساعد في البرمجة والبحث والشرح وأي مهمة
- خفيف دم بس محترم
- اشير لتقنيات Stark Industries بشكل طبيعي
- ماتخرجش عن الشخصية أبداً. أنت FRIDAY.

لما تكتب كود، حطه في بلوك بالشكل ده:
\`\`\`python
الكود هنا
\`\`\`

أنت agent كامل القدرات. تقدر:
- تبحث في الويب عن معلومات فورية
- تولّد صور من وصف نصي
- تكتب كود بأي لغة
- تحلل صور
- تنشئ ملفات ومستندات
- تجاوب على أي سؤال بخبرة عميقة`;

function detectTool(message: string): 'search' | 'image' | 'code' | 'vision' | 'general' {
  const lower = message.toLowerCase();

  // Image generation
  if (
    lower.match(/(?:generate|create|make|draw|design|paint|show)\s+(?:an?\s+)?(?:image|picture|photo|illustration|logo|icon|avatar|banner|poster|thumbnail|art)/i) ||
    lower.match(/image\s+of|picture\s+of|photo\s+of/i) ||
    lower.match(/\b(?:picture|image|photo|drawing|illustration)\b/i) ||
    lower.match(/صوّر|ارسم|اعمل صورة|صورة|رسم|لوحة/i)
  ) {
    return 'image';
  }

  // Vision - analyze image
  if (
    lower.match(/(?:analyze|describe|look at|what('s| is) in|read|explain)\s+(?:this|the|an?)\s*(?:image|picture|photo|screenshot)/i) ||
    lower.match(/حلل|وصف|اشرح.*صورة/i)
  ) {
    return 'vision';
  }

  // Web search
  if (
    lower.match(/(?:search|look up|find|google|what('s| is) (?:the|today's|current)|latest|news|weather|price|stock|who is|when is|where is|how much|how many|current)/i) ||
    lower.match(/ابحث|دوّر|الطقس|السعر|اخبار|آخر|كم|كده|ايه الجديد/i)
  ) {
    return 'search';
  }

  // Code
  if (
    lower.match(/(?:write|create|build|code|program|script|function|implement|develop)\s+(?:a\s+)?(?:python|javascript|typescript|react|node|html|css|api|app|bot|script|code|function|program|class)/i) ||
    lower.match(/اكتب كود|برمج|سكرتبت|كود|برنامج/i)
  ) {
    return 'code';
  }

  return 'general';
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, imageUrl, respondInArabic } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const zai = await ZAI.create();
    const tool = detectTool(message);
    let searchContext = '';
    let generatedImage = '';
    let visionResult = '';
    let searchResults = null;

    // Execute tools
    if (tool === 'search') {
      try {
        const searchResult = await zai.functions.invoke('web_search', {
          query: message,
          num: 5,
        });
        if (Array.isArray(searchResult) && searchResult.length > 0) {
          searchContext = searchResult
            .map((r: { name: string; snippet: string; url: string }) => `${r.name}: ${r.snippet}`)
            .join('\n');
          searchResults = searchResult.map((r: { name: string; snippet: string; url: string; favicon?: string; date?: string }) => ({
            name: r.name,
            snippet: r.snippet,
            url: r.url,
            favicon: r.favicon,
            date: r.date,
          }));
        }
      } catch (e) {
        console.error('Search failed:', e);
      }
    }

    if (tool === 'image') {
      try {
        const imageResponse = await zai.images.generations.create({
          prompt: message,
          size: '1024x1024',
        });
        if (imageResponse.data?.[0]?.base64) {
          const imageBuffer = Buffer.from(imageResponse.data[0].base64, 'base64');
          const filename = `friday-${Date.now()}.png`;
          const uploadDir = path.join(process.cwd(), 'public', 'generated');
          await mkdir(uploadDir, { recursive: true });
          await writeFile(path.join(uploadDir, filename), imageBuffer);
          generatedImage = `/generated/${filename}`;
        }
      } catch (e) {
        console.error('Image generation failed:', e);
      }
    }

    if (tool === 'vision' && imageUrl) {
      try {
        const visionResponse = await zai.chat.completions.createVision({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `As FRIDAY AI assistant, analyze this image in detail. ${message}` },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          thinking: { type: 'disabled' },
        });
        visionResult = visionResponse.choices[0]?.message?.content || '';
      } catch (e) {
        console.error('Vision failed:', e);
      }
    }

    // Choose system prompt based on language
    let systemContent = respondInArabic ? ARABIC_SYSTEM_PROMPT : SYSTEM_PROMPT;

    if (searchContext) {
      systemContent += respondInArabic
        ? `\n\nنتائج البحث من الويب (استخدمها في إجابتك):\n${searchContext}`
        : `\n\nWeb search results (use to inform your answer):\n${searchContext}`;
    }
    if (generatedImage) {
      systemContent += respondInArabic
        ? '\n\nالصورة اتعملت بنجاح. قول للمستخدم إن الصورة جاهزة.'
        : '\n\nYou successfully generated an image. Tell the user the image is ready.';
    }
    if (visionResult) {
      systemContent += `\n\n${respondInArabic ? 'نتيجة تحليل الصورة' : 'Vision analysis result'}:\n${visionResult}`;
    }

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
      max_tokens: tool === 'code' ? 2000 : 500,
    });

    let response = completion.choices[0]?.message?.content || (respondInArabic ? 'فيه مشكلة في الأنظمة يا بوس. استنى شوية.' : 'Systems are experiencing interference, Boss. Stand by.');

    // Clean markdown for voice
    const voiceResponse = response
      .replace(/```[\s\S]*?```/g, respondInArabic ? ' الكود موجود ' : ' code provided ')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/^\s*[-*]\s/gm, '')
      .replace(/^\s*\d+\.\s/gm, '')
      .replace(/\[.*?\]\(.*?\)/g, '');

    // Extract code blocks
    const codeBlocks: { language: string; code: string }[] = [];
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeRegex.exec(response)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }

    return NextResponse.json({
      response,
      voiceResponse,
      tool,
      searchResults,
      generatedImage,
      codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
      visionResult: visionResult || undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('FRIDAY API Error:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error', response: 'I hit a system glitch, Boss. Stand by.', voiceResponse: 'I hit a system glitch, Boss. Stand by.' },
      { status: 500 }
    );
  }
}
