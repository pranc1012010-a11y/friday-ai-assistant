'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Globe, Image as ImageIcon, Code, Eye, Copy, Check, ExternalLink, Languages } from 'lucide-react';

interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  originalArabic?: string;
  tool?: string;
  searchResults?: { name: string; snippet: string; url: string }[];
  generatedImage?: string;
  codeBlocks?: { language: string; code: string }[];
  visionResult?: string;
}

type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Detect if text is Arabic
function isArabic(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

export default function VoiceAgent() {
  const [state, setState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [muted, setMuted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const historyRef = useRef<VoiceMessage[]>([]);
  const shouldListenRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const processMessageRef = useRef<(msg: string) => Promise<void>>(async () => {});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const speak = useCallback((text: string, isArabicText: boolean, onEnd?: () => void) => {
    if (!synthRef.current || muted) {
      if (onEnd) onEnd();
      return;
    }
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isArabicText ? 0.95 : 1.05;
    utterance.pitch = 1.15;
    utterance.volume = 0.9;
    utterance.lang = isArabicText ? 'ar-EG' : 'en-US';

    const voices = synthRef.current.getVoices();

    if (isArabicText) {
      // Try Arabic voice
      const arabicVoice = voices.find((v) => v.lang.startsWith('ar'));
      if (arabicVoice) utterance.voice = arabicVoice;
    } else {
      // English female voice
      const femaleVoice = voices.find(
        (v) =>
          (v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('karen') ||
            v.name.toLowerCase().includes('victoria') ||
            v.name.toLowerCase().includes('zira') ||
            (v.name.toLowerCase().includes('google') && v.lang.startsWith('en'))) &&
          v.lang.startsWith('en')
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      else {
        const englishVoice = voices.find((v) => v.lang.startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
      }
    }

    utterance.onstart = () => setState('speaking');
    utterance.onend = () => {
      setState('idle');
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      setState('idle');
      if (onEnd) onEnd();
    };

    synthRef.current.speak(utterance);
  }, [muted]);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      (window as unknown as Record<string, typeof window.SpeechRecognition>)['SpeechRecognition'] ||
      (window as unknown as Record<string, typeof window.SpeechRecognition>)['webkitSpeechRecognition'];
    if (!SpeechRecognitionAPI) {
      speak('Voice recognition not available in this browser, Boss. Try Chrome.', false);
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    // Set language based on current mode - ar-EG for Arabic, en-US for English
    recognition.lang = lang === 'ar' ? 'ar-EG' : 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => setState('listening');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript(finalTranscript || interim);
    };

    recognition.onend = () => {
      if (finalTranscript.trim()) {
        setState('thinking');
        setTranscript('');
        processMessageRef.current(finalTranscript.trim());
      } else if (shouldListenRef.current) {
        setState('idle');
        setTimeout(() => { if (shouldListenRef.current) startListeningRef.current(); }, 500);
      } else {
        setState('idle');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' && shouldListenRef.current) {
        setState('idle');
        setTimeout(() => { if (shouldListenRef.current) startListeningRef.current(); }, 500);
      } else {
        setState('idle');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [speak, lang]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const processMessage = useCallback(async (userMessage: string) => {
    const isArabicInput = isArabic(userMessage);
    let messageForAI = userMessage;
    let translatedFromArabic = '';

    // If Arabic, translate to English for the AI
    if (isArabicInput) {
      try {
        const translateRes = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: userMessage, targetLang: 'en' }),
        });
        const translateData = await translateRes.json();
        if (translateData.translation && translateData.translation !== userMessage) {
          translatedFromArabic = userMessage;
          messageForAI = translateData.translation;
        }
      } catch {
        // If translation fails, use original Arabic
      }
    }

    // Auto-detect language preference
    if (isArabicInput && lang !== 'ar') setLang('ar');

    const history = historyRef.current.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/friday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageForAI,
          history,
          respondInArabic: isArabicInput,
        }),
      });

      const data = await res.json();
      let responseText = data.response || 'Systems experiencing interference, Boss. Stand by.';
      let voiceText = data.voiceResponse || data.response || '';

      // If user spoke Arabic, translate the response back to Arabic
      if (isArabicInput && !isArabic(responseText)) {
        try {
          const translateBackRes = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: responseText, targetLang: 'ar' }),
          });
          const translateBackData = await translateBackRes.json();
          if (translateBackData.translation) {
            voiceText = translateBackData.translation;
            // Keep original English for display, Arabic for voice
          }
        } catch {
          // If translation fails, use English response
        }
      }

      const assistantMsg: VoiceMessage = {
        role: 'assistant',
        content: responseText,
        originalArabic: isArabicInput && !isArabic(responseText) ? voiceText : undefined,
        tool: data.tool,
        searchResults: data.searchResults,
        generatedImage: data.generatedImage,
        codeBlocks: data.codeBlocks,
        visionResult: data.visionResult,
      };
      const userMsg: VoiceMessage = {
        role: 'user',
        content: userMessage,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      historyRef.current = [...historyRef.current, { role: 'user', content: messageForAI }, { role: 'assistant', content: responseText }];

      // Speak in the appropriate language
      const speakArabic = isArabicInput && isArabic(voiceText);
      speak(voiceText, speakArabic, () => {
        if (shouldListenRef.current) startListeningRef.current();
      });
    } catch {
      const errorMsg: VoiceMessage = { role: 'assistant', content: 'Network glitch, Boss. Try again.' };
      setMessages((prev) => [...prev, errorMsg]);
      speak(isArabicInput ? 'في مشكلة في الاتصال يا بوس. حاول تاني.' : 'Network glitch, Boss. Try again.', isArabicInput, () => {
        if (shouldListenRef.current) startListeningRef.current();
      });
    }
  }, [speak, lang]);

  useEffect(() => {
    processMessageRef.current = processMessage;
  }, [processMessage]);

  const activate = useCallback(() => {
    if (isActive) return;
    setIsActive(true);
    shouldListenRef.current = true;

    const greetingAr = 'أهلاً يا بوس. كل الأنظمة شغالة. عايز أعملك إيه؟';
    const greetingEn = 'Good to see you, Boss. All systems online. What do you need me to handle?';
    const isArabicMode = lang === 'ar';
    const greeting = isArabicMode ? greetingAr : greetingEn;

    const msg: VoiceMessage = { role: 'assistant', content: greeting };
    setMessages([msg]);
    historyRef.current = [msg];
    speak(greeting, isArabicMode, () => startListening());
  }, [isActive, speak, startListening, lang]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    shouldListenRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    if (synthRef.current) synthRef.current.cancel();
    setState('idle');
    setTranscript('');
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (!prev && synthRef.current) synthRef.current.cancel();
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !synthRef.current) return;
    synthRef.current.getVoices();
    synthRef.current.onvoiceschanged = () => { synthRef.current!.getVoices(); };
  }, []);

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toolBadge = (tool?: string) => {
    switch (tool) {
      case 'search': return <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full"><Globe className="w-2.5 h-2.5" />SEARCH</span>;
      case 'image': return <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full"><ImageIcon className="w-2.5 h-2.5" />IMAGE</span>;
      case 'code': return <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full"><Code className="w-2.5 h-2.5" />CODE</span>;
      case 'vision': return <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-pink-500/15 text-pink-400 px-2 py-0.5 rounded-full"><Eye className="w-2.5 h-2.5" />VISION</span>;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,200,255,0.2) transparent' }}>

        {/* Activation Screen */}
        {!isActive ? (
          <div className="h-full flex flex-col items-center justify-center">
            <button onClick={activate} className="group relative flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center transition-all group-hover:bg-cyan-500/20 group-hover:border-cyan-400/50 group-hover:scale-105">
                  <Mic className="w-8 h-8 text-cyan-400 transition-all group-hover:text-cyan-300" />
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full border border-cyan-400/20 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-cyan-400 font-mono text-sm tracking-wider">TAP TO ACTIVATE</p>
                <p className="text-gray-600 font-mono text-xs mt-1">اضغط عشان تبدأ</p>
              </div>
            </button>

            {/* Language Toggle */}
            <div className="mt-6 flex items-center gap-2">
              <Languages className="w-4 h-4 text-gray-600" />
              <button
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/60 border border-gray-700/50 text-gray-400 font-mono text-xs hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
              >
                <span className={lang === 'ar' ? 'text-cyan-400' : ''}>عربي</span>
                <span className="text-gray-700">|</span>
                <span className={lang === 'en' ? 'text-cyan-400' : ''}>English</span>
              </button>
            </div>
          </div>
        ) : (
          /* Messages */
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {/* User message */}
                {msg.role === 'user' && (
                  <div className="bg-cyan-500/15 text-cyan-100 border border-cyan-500/25 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm font-mono" dir={isArabic(msg.content) ? 'rtl' : 'ltr'}>
                    {msg.content}
                  </div>
                )}

                {/* Assistant message */}
                {msg.role === 'assistant' && (
                  <div className="space-y-2">
                    <div className="bg-gray-800/50 border border-gray-700/40 px-4 py-2.5 rounded-2xl rounded-tl-sm">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-cyan-400/60 text-[10px] font-mono tracking-wider">FRIDAY</span>
                        {toolBadge(msg.tool)}
                      </div>
                      <p className="text-gray-200 text-sm leading-relaxed" dir={isArabic(msg.content) ? 'rtl' : 'ltr'}>{msg.content}</p>
                      {/* Show Arabic translation if available */}
                      {msg.originalArabic && (
                        <p className="text-cyan-400/40 text-xs mt-2 pt-2 border-t border-gray-700/30 leading-relaxed" dir="rtl">{msg.originalArabic}</p>
                      )}
                    </div>

                    {/* Generated Image */}
                    {msg.generatedImage && (
                      <div className="rounded-xl overflow-hidden border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                        <img src={msg.generatedImage} alt="Generated" className="w-full" />
                      </div>
                    )}

                    {/* Search Results */}
                    {msg.searchResults && msg.searchResults.length > 0 && (
                      <div className="space-y-2">
                        {msg.searchResults.map((r, j) => (
                          <div key={j} className="p-3 rounded-xl bg-green-500/5 border border-green-500/15 hover:border-green-500/30 transition-colors">
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-cyan-400 text-sm hover:underline">
                              {r.name}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <p className="text-gray-400 text-xs mt-1 leading-relaxed">{r.snippet}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Code Blocks */}
                    {msg.codeBlocks?.map((block, j) => (
                      <div key={j} className="rounded-xl overflow-hidden border border-amber-500/15">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/5 border-b border-amber-500/15">
                          <span className="text-amber-400/70 font-mono text-xs">{block.language}</span>
                          <button onClick={() => copyCode(block.code, j)} className="text-gray-500 hover:text-cyan-400 transition-colors">
                            {copiedIndex === j ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <pre className="p-3 overflow-x-auto text-xs text-gray-300 font-mono leading-relaxed bg-black/50" style={{ scrollbarWidth: 'thin' }}>
                          <code>{block.code}</code>
                        </pre>
                      </div>
                    ))}

                    {/* Vision Result */}
                    {msg.visionResult && (
                      <div className="p-3 rounded-xl bg-pink-500/5 border border-pink-500/15">
                        <p className="text-gray-300 text-sm leading-relaxed">{msg.visionResult}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Thinking indicator */}
        {state === 'thinking' && (
          <div className="flex justify-start">
            <div className="bg-gray-800/50 border border-gray-700/40 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-cyan-400/60 text-xs font-mono tracking-wider">{lang === 'ar' ? 'بفكر...' : 'PROCESSING'}</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Listening bar */}
      {state === 'listening' && (
        <div className="border-t border-cyan-500/10 bg-black/80 px-4 py-2">
          <div className="flex items-center justify-center gap-3">
            <div className="flex gap-1 items-end">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="w-1.5 bg-cyan-400 rounded-full animate-pulse"
                  style={{ height: `${6 + Math.random() * 20}px`, animationDelay: `${i * 0.08}s`, animationDuration: `${0.3 + Math.random() * 0.4}s` }}
                />
              ))}
            </div>
            <span className="text-cyan-400 font-mono text-xs tracking-wider animate-pulse">{lang === 'ar' ? 'سمعتك...' : 'LISTENING'}</span>
            <span className="text-cyan-100/60 text-sm font-mono" dir={isArabic(transcript) ? 'rtl' : 'ltr'}>{transcript}</span>
          </div>
        </div>
      )}

      {/* Speaking indicator */}
      {state === 'speaking' && (
        <div className="border-t border-cyan-500/10 bg-black/80 px-4 py-2">
          <div className="flex items-center justify-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="text-purple-400/70 font-mono text-xs tracking-wider">{lang === 'ar' ? 'بقولك...' : 'SPEAKING'}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      {isActive && (
        <div className="border-t border-cyan-500/10 bg-black/90 px-4 py-3 flex items-center justify-center gap-4">
          <button onClick={toggleMute} className={`p-2.5 rounded-xl transition-all ${muted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-cyan-400'}`} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              const newLang = lang === 'ar' ? 'en' : 'ar';
              setLang(newLang);
            }}
            className={`p-2.5 rounded-xl transition-all bg-gray-800/60 border border-gray-700/50 hover:text-cyan-400 text-xs font-mono`}
            title="Switch language"
          >
            <Languages className="w-4 h-4" />
          </button>

          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
            state === 'listening' ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,200,255,0.3)]' :
            state === 'thinking' ? 'bg-amber-500/10 border-2 border-amber-500/30' :
            state === 'speaking' ? 'bg-purple-500/10 border-2 border-purple-500/30' :
            'bg-cyan-500/10 border-2 border-cyan-500/20'
          }`}>
            {state === 'listening' && <Mic className="w-5 h-5 text-cyan-300" />}
            {state === 'thinking' && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
            {state === 'speaking' && <Volume2 className="w-5 h-5 text-purple-300 animate-pulse" />}
            {state === 'idle' && <Mic className="w-5 h-5 text-cyan-400/50" />}
          </div>

          <button onClick={deactivate} className="p-2.5 rounded-xl bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-red-400 hover:border-red-500/30 transition-all" title="Deactivate">
            <MicOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current language indicator */}
      {isActive && (
        <div className="text-center py-1 bg-black/60">
          <span className="text-gray-700 font-mono text-[10px]">
            {lang === 'ar' ? '🎤 عربي' : '🎤 English'}
          </span>
        </div>
      )}
    </div>
  );
}
