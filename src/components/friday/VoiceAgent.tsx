'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Languages, X, Copy, Check, ExternalLink, Globe, Image as ImageIcon, Code, Eye } from 'lucide-react';

interface ResultPanel {
  type: 'image' | 'search' | 'code' | 'vision';
  imageUrl?: string;
  searchResults?: { name: string; snippet: string; url: string }[];
  codeBlocks?: { language: string; code: string }[];
  visionText?: string;
}

type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export default function VoiceAgent() {
  const [state, setState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [resultPanel, setResultPanel] = useState<ResultPanel | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [lastTool, setLastTool] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const shouldListenRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const processMessageRef = useRef<(msg: string) => Promise<void>>(async () => {});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const stateRef = useRef<AgentState>('idle');

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (typeof window !== 'undefined') synthRef.current = window.speechSynthesis;
  }, []);

  // Arc Reactor Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const currentState = stateRef.current;

      // Dynamic parameters based on state
      let coreGlow = 0.25;
      let ringOpacity = 0.15;
      let particleSpeed = 0.02;
      let segmentGlow = 0.4;
      let coreSize = 12;
      let outerRingWidth = 2;

      if (currentState === 'listening') {
        coreGlow = 0.5;
        ringOpacity = 0.3;
        particleSpeed = 0.04;
        segmentGlow = 0.7;
        coreSize = 16;
        outerRingWidth = 3;
      } else if (currentState === 'thinking') {
        coreGlow = 0.6;
        ringOpacity = 0.2;
        particleSpeed = 0.06;
        segmentGlow = 0.9;
        coreSize = 14;
        outerRingWidth = 2.5;
      } else if (currentState === 'speaking') {
        coreGlow = 0.45;
        ringOpacity = 0.25;
        particleSpeed = 0.03;
        segmentGlow = 0.6;
        coreSize = 15;
        outerRingWidth = 2;
      }

      // Outer rotating ring
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(time * (currentState === 'thinking' ? 0.015 : 0.005));
      ctx.beginPath();
      ctx.arc(0, 0, 130, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 200, 255, ${ringOpacity})`;
      ctx.lineWidth = outerRingWidth;
      ctx.stroke();

      // Tick marks
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const innerR = i % 3 === 0 ? 118 : 123;
        const outerR = 130;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
        ctx.strokeStyle = i % 3 === 0 ? `rgba(0, 200, 255, ${segmentGlow})` : `rgba(0, 200, 255, ${ringOpacity + 0.05})`;
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();

      // Middle pulsing ring
      const pulseAmt = currentState === 'listening' ? 10 : currentState === 'thinking' ? 8 : 5;
      const pulseRadius = 100 + Math.sin(time * 0.03) * pulseAmt;
      ctx.beginPath();
      ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 200, 255, ${0.3 + Math.sin(time * 0.03) * 0.15})`;
      ctx.lineWidth = currentState === 'listening' ? 2.5 : 1.5;
      ctx.stroke();

      // Listening wave rings
      if (currentState === 'listening') {
        for (let w = 0; w < 3; w++) {
          const waveR = 100 + ((time * 2 + w * 30) % 60);
          const waveOpacity = Math.max(0, 0.3 - (waveR - 100) / 200);
          ctx.beginPath();
          ctx.arc(center, center, waveR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 200, 255, ${waveOpacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Core glow
      const glowSize = 80 + (currentState !== 'idle' ? Math.sin(time * 0.05) * 10 : 0);
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, glowSize);
      gradient.addColorStop(0, `rgba(0, 220, 255, ${coreGlow})`);
      gradient.addColorStop(0.4, `rgba(0, 150, 255, ${coreGlow * 0.3})`);
      gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center, center, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Inner rotating segments
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(-time * (currentState === 'thinking' ? 0.02 : 0.01));
      for (let i = 0; i < 6; i++) {
        const startAngle = (i / 6) * Math.PI * 2 + 0.05;
        const endAngle = startAngle + (Math.PI * 2) / 6 - 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, 65, startAngle, endAngle);
        ctx.strokeStyle = `rgba(0, 200, 255, ${segmentGlow + Math.sin(time * 0.05 + i) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();

      // Center core
      const coreGradient = ctx.createRadialGradient(center, center, 0, center, center, coreSize);
      coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGradient.addColorStop(0.5, `rgba(0, 220, 255, ${coreGlow + 0.3})`);
      coreGradient.addColorStop(1, 'rgba(0, 150, 255, 0)');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(center, center, coreSize, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting particles
      for (let i = 0; i < 4; i++) {
        const orbitAngle = time * particleSpeed + (i / 4) * Math.PI * 2;
        const orbitR = 82 + Math.sin(time * 0.04 + i) * 5;
        const px = center + Math.cos(orbitAngle) * orbitR;
        const py = center + Math.sin(orbitAngle) * orbitR;
        const particleGrad = ctx.createRadialGradient(px, py, 0, px, py, 4);
        particleGrad.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
        particleGrad.addColorStop(1, 'rgba(0, 200, 255, 0)');
        ctx.fillStyle = particleGrad;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Radar sweep
      ctx.save();
      ctx.translate(center, center);
      const sweepAngle = time * 0.015;
      const sweepGrad = ctx.createConicGradient(sweepAngle, 0, 0);
      sweepGrad.addColorStop(0, `rgba(0, 200, 255, ${ringOpacity})`);
      sweepGrad.addColorStop(0.1, 'rgba(0, 200, 255, 0)');
      sweepGrad.addColorStop(1, 'rgba(0, 200, 255, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      time++;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  // Speak function with Arabic support
  const speak = useCallback((text: string, inArabic: boolean, onEnd?: () => void) => {
    if (!synthRef.current || muted) {
      if (onEnd) onEnd();
      return;
    }
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = inArabic ? 0.95 : 1.05;
    utterance.pitch = inArabic ? 1.05 : 1.15;
    utterance.volume = 0.9;
    utterance.lang = inArabic ? 'ar-EG' : 'en-US';

    const voices = synthRef.current.getVoices();

    if (inArabic) {
      // Find Arabic voice
      const arabicVoice = voices.find(
        (v) => v.lang.startsWith('ar') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('mona') || v.name.toLowerCase().includes('laila') || !v.name.toLowerCase().includes('male'))
      ) || voices.find((v) => v.lang.startsWith('ar'));
      if (arabicVoice) utterance.voice = arabicVoice;
    } else {
      // Find English female voice
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
    utterance.onend = () => { setState('idle'); if (onEnd) onEnd(); };
    utterance.onerror = () => { setState('idle'); if (onEnd) onEnd(); };

    synthRef.current.speak(utterance);
  }, [muted]);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      (window as unknown as Record<string, typeof window.SpeechRecognition>)['SpeechRecognition'] ||
      (window as unknown as Record<string, typeof window.SpeechRecognition>)['webkitSpeechRecognition'];
    if (!SpeechRecognitionAPI) {
      speak('Voice recognition not available, Boss. Try Chrome.', false);
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
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

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const processMessage = useCallback(async (userMessage: string) => {
    const arabicInput = isArabic(userMessage);
    let messageForAI = userMessage;

    // If Arabic input, translate to English first for processing
    if (arabicInput) {
      try {
        const translateRes = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: userMessage }),
        });
        const translateData = await translateRes.json();
        if (translateData.translation && translateData.translation !== userMessage) {
          messageForAI = translateData.translation;
        }
      } catch {
        // If translation fails, send Arabic directly
      }
    }

    const history = historyRef.current;

    try {
      const res = await fetch('/api/friday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageForAI,
          history,
          respondInArabic: arabicInput,
        }),
      });

      const data = await res.json();
      const responseText = data.response || 'Systems experiencing interference, Boss. Stand by.';
      const voiceText = data.voiceResponse || responseText;
      setLastResponse(responseText);
      setLastTool(data.tool || null);

      // Set result panel if there are results
      if (data.generatedImage) {
        setResultPanel({ type: 'image', imageUrl: data.generatedImage });
      } else if (data.searchResults?.length > 0) {
        setResultPanel({ type: 'search', searchResults: data.searchResults });
      } else if (data.codeBlocks?.length > 0) {
        setResultPanel({ type: 'code', codeBlocks: data.codeBlocks });
      } else if (data.visionResult) {
        setResultPanel({ type: 'vision', visionText: data.visionResult });
      } else {
        setResultPanel(null);
      }

      historyRef.current = [...history, { role: 'user', content: messageForAI }, { role: 'assistant', content: responseText }];

      // Speak in Arabic if user spoke Arabic, otherwise English
      speak(voiceText, arabicInput, () => {
        if (shouldListenRef.current) startListeningRef.current();
      });
    } catch {
      setLastResponse('Network glitch, Boss. Try again.');
      speak('Network glitch, Boss. Try again.', false, () => {
        if (shouldListenRef.current) startListeningRef.current();
      });
    }
  }, [speak]);

  useEffect(() => { processMessageRef.current = processMessage; }, [processMessage]);

  const activate = useCallback(() => {
    if (isActive) return;
    setIsActive(true);
    shouldListenRef.current = true;

    const greeting = lang === 'ar'
      ? 'أهلاً يا بوس. كل الأنظمة شغالة. محتاج إيه؟'
      : 'Good to see you, Boss. All systems online. What do you need me to handle?';
    setLastResponse(greeting);
    speak(greeting, lang === 'ar', () => startListening());
  }, [isActive, speak, startListening, lang]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    shouldListenRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    if (synthRef.current) synthRef.current.cancel();
    setState('idle');
    setTranscript('');
    setLastResponse('');
    setResultPanel(null);
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

  const stateLabels = {
    idle: { en: 'STANDBY', ar: 'في الانتظار' },
    listening: { en: 'LISTENING', ar: 'سمعتك...' },
    thinking: { en: 'PROCESSING', ar: 'بدور...' },
    speaking: { en: 'SPEAKING', ar: 'هرد عليك...' },
  };

  const stateColors = {
    idle: 'cyan',
    listening: 'cyan',
    thinking: 'amber',
    speaking: 'purple',
  };

  const color = stateColors[state];

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Main Voice Interface - No Chat! */}
      <div className="flex-1 flex flex-col items-center justify-center relative">

        {/* Arc Reactor Canvas */}
        <div className="relative">
          <canvas ref={canvasRef} className="w-[320px] h-[320px]" />

          {/* State indicator text inside reactor */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center mt-12">
              <span className={`font-mono text-xs tracking-[0.3em] ${
                color === 'cyan' ? 'text-cyan-400/70' :
                color === 'amber' ? 'text-amber-400/70' :
                'text-purple-400/70'
              }`}>
                {lang === 'ar' ? stateLabels[state].ar : stateLabels[state].en}
              </span>
            </div>
          </div>
        </div>

        {/* Transcript - what user is saying */}
        {state === 'listening' && transcript && (
          <div className="mt-4 max-w-md text-center animate-pulse-once">
            <p className="text-cyan-100/80 text-sm font-mono" dir={isArabic(transcript) ? 'rtl' : 'ltr'}>
              &ldquo;{transcript}&rdquo;
            </p>
          </div>
        )}

        {/* Thinking animation */}
        {state === 'thinking' && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Last response text */}
        {state === 'speaking' && lastResponse && (
          <div className="mt-4 max-w-lg text-center animate-pulse-once">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-purple-400/60 text-[10px] font-mono tracking-wider">FRIDAY</span>
              {lastTool && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  lastTool === 'search' ? 'bg-green-500/15 text-green-400' :
                  lastTool === 'image' ? 'bg-purple-500/15 text-purple-400' :
                  lastTool === 'code' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-pink-500/15 text-pink-400'
                }`}>
                  {lastTool === 'search' && <><Globe className="w-2.5 h-2.5" />SEARCH</>}
                  {lastTool === 'image' && <><ImageIcon className="w-2.5 h-2.5" />IMAGE</>}
                  {lastTool === 'code' && <><Code className="w-2.5 h-2.5" />CODE</>}
                  {lastTool === 'vision' && <><Eye className="w-2.5 h-2.5" />VISION</>}
                </span>
              )}
            </div>
            <p className="text-gray-200/90 text-sm leading-relaxed" dir={isArabic(lastResponse) ? 'rtl' : 'ltr'}>
              {lastResponse}
            </p>
          </div>
        )}

        {/* Idle - show last response if exists */}
        {state === 'idle' && lastResponse && isActive && (
          <div className="mt-4 max-w-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" />
              <span className="text-cyan-400/40 text-[10px] font-mono tracking-wider">FRIDAY</span>
              {lastTool && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  lastTool === 'search' ? 'bg-green-500/10 text-green-400/60' :
                  lastTool === 'image' ? 'bg-purple-500/10 text-purple-400/60' :
                  lastTool === 'code' ? 'bg-amber-500/10 text-amber-400/60' :
                  'bg-pink-500/10 text-pink-400/60'
                }`}>
                  {lastTool === 'search' && <><Globe className="w-2.5 h-2.5" />SEARCH</>}
                  {lastTool === 'image' && <><ImageIcon className="w-2.5 h-2.5" />IMAGE</>}
                  {lastTool === 'code' && <><Code className="w-2.5 h-2.5" />CODE</>}
                  {lastTool === 'vision' && <><Eye className="w-2.5 h-2.5" />VISION</>}
                </span>
              )}
            </div>
            <p className="text-gray-400/70 text-sm leading-relaxed" dir={isArabic(lastResponse) ? 'rtl' : 'ltr'}>
              {lastResponse}
            </p>
            {resultPanel && (
              <button
                onClick={() => setResultPanel(null)}
                className="mt-2 text-cyan-400/40 text-[10px] font-mono hover:text-cyan-400/80 transition-colors"
              >
                {lang === 'ar' ? 'اضغط عشان تشوف النتايج' : 'TAP TO VIEW RESULTS'}
              </button>
            )}
          </div>
        )}

        {/* Activation Screen */}
        {!isActive && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <button onClick={activate} className="group relative flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center transition-all group-hover:bg-cyan-500/20 group-hover:border-cyan-400/50 group-hover:scale-105">
                  <Mic className="w-7 h-7 text-cyan-400 transition-all group-hover:text-cyan-300" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full border border-cyan-400/20 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-cyan-400 font-mono text-sm tracking-wider">ACTIVATE FRIDAY</p>
                <p className="text-gray-600 font-mono text-xs mt-1">شغّل FRIDAY</p>
              </div>
            </button>

            {/* Language Toggle */}
            <div className="mt-4 flex items-center gap-2">
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
            <p className="text-gray-700 font-mono text-[10px]">
              {lang === 'ar' ? 'هيفهمك عربي وهيرد عليك عربي' : 'Understands Arabic, responds in Arabic'}
            </p>
          </div>
        )}
      </div>

      {/* Result Panel Overlay */}
      {resultPanel && isActive && (
        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-md w-full max-h-[80%] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,200,255,0.2) transparent' }}>
            <button
              onClick={() => setResultPanel(null)}
              className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-gray-800/80 border border-gray-700/50 text-gray-400 hover:text-cyan-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Image Result */}
            {resultPanel.type === 'image' && resultPanel.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                <img src={resultPanel.imageUrl} alt="Generated" className="w-full" />
              </div>
            )}

            {/* Search Results */}
            {resultPanel.type === 'search' && resultPanel.searchResults && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Globe className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-mono text-xs tracking-wider">SEARCH RESULTS</span>
                </div>
                {resultPanel.searchResults.map((r, j) => (
                  <div key={j} className="p-3 rounded-xl bg-gray-900/80 border border-green-500/15 hover:border-green-500/30 transition-colors">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-cyan-400 text-sm hover:underline">
                      {r.name}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-gray-400 text-xs mt-1 leading-relaxed">{r.snippet}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Code Result */}
            {resultPanel.type === 'code' && resultPanel.codeBlocks && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Code className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 font-mono text-xs tracking-wider">CODE</span>
                </div>
                {resultPanel.codeBlocks.map((block, j) => (
                  <div key={j} className="rounded-xl overflow-hidden border border-amber-500/15">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/5 border-b border-amber-500/15">
                      <span className="text-amber-400/70 font-mono text-xs">{block.language}</span>
                      <button onClick={() => copyCode(block.code, j)} className="text-gray-500 hover:text-cyan-400 transition-colors">
                        {copiedIndex === j ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <pre className="p-3 overflow-x-auto text-xs text-gray-300 font-mono leading-relaxed bg-black/70" style={{ scrollbarWidth: 'thin' }}>
                      <code>{block.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {/* Vision Result */}
            {resultPanel.type === 'vision' && resultPanel.visionText && (
              <div className="p-4 rounded-xl bg-gray-900/80 border border-pink-500/15">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-pink-400" />
                  <span className="text-pink-400 font-mono text-xs tracking-wider">VISION ANALYSIS</span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{resultPanel.visionText}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      {isActive && (
        <div className="border-t border-cyan-500/10 bg-black/90 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-center gap-3">
            {/* Mute */}
            <button onClick={toggleMute} className={`p-2.5 rounded-xl transition-all ${
              muted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-cyan-400'
            }`} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className={`p-2.5 rounded-xl transition-all bg-gray-800/60 border ${
                lang === 'ar' ? 'border-cyan-500/30 text-cyan-400' : 'border-gray-700/50 text-gray-500 hover:text-cyan-400'
              }`}
              title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربي'}
            >
              <Languages className="w-4 h-4" />
            </button>

            {/* Central State Orb */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
              state === 'listening' ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_25px_rgba(0,200,255,0.3)] scale-110' :
              state === 'thinking' ? 'bg-amber-500/10 border-2 border-amber-500/30 scale-105' :
              state === 'speaking' ? 'bg-purple-500/10 border-2 border-purple-500/30 scale-105' :
              'bg-cyan-500/10 border-2 border-cyan-500/20'
            }`}>
              {state === 'listening' && <Mic className="w-6 h-6 text-cyan-300" />}
              {state === 'thinking' && <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
              {state === 'speaking' && <Volume2 className="w-6 h-6 text-purple-300 animate-pulse" />}
              {state === 'idle' && <Mic className="w-6 h-6 text-cyan-400/50" />}
            </div>

            {/* Deactivate */}
            <button onClick={deactivate} className="p-2.5 rounded-xl bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-red-400 hover:border-red-500/30 transition-all" title="Deactivate">
              <MicOff className="w-4 h-4" />
            </button>
          </div>

          {/* Language indicator bar */}
          <div className="text-center mt-2">
            <span className="text-gray-700 font-mono text-[10px]">
              {lang === 'ar' ? 'العربي → تترجم تلقائي → بيرد عربي' : 'English → Process → English Response'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
