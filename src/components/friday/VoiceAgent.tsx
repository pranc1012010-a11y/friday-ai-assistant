'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Globe, Image as ImageIcon, Code, Eye, X, Copy, Check } from 'lucide-react';

interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  tool?: string;
  searchResults?: { name: string; snippet: string; url: string }[];
  generatedImage?: string;
  codeBlocks?: { language: string; code: string }[];
  visionResult?: string;
}

type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function VoiceAgent() {
  const [state, setState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [muted, setMuted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [activeResult, setActiveResult] = useState<VoiceMessage | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const historyRef = useRef<VoiceMessage[]>([]);
  const shouldListenRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const processMessageRef = useRef<(msg: string) => Promise<void>>(async () => {});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current || muted) {
      if (onEnd) onEnd();
      return;
    }
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.15;
    utterance.volume = 0.9;

    const voices = synthRef.current.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        (v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('samantha') ||
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
      speak('Voice recognition is not available in this browser, Boss. You might need to use Chrome.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

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
  }, [speak]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const processMessage = useCallback(async (userMessage: string) => {
    const history = historyRef.current.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/friday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
      });

      const data = await res.json();
      const assistantMsg: VoiceMessage = {
        role: 'assistant',
        content: data.response || 'Systems experiencing interference, Boss. Stand by.',
        tool: data.tool,
        searchResults: data.searchResults,
        generatedImage: data.generatedImage,
        codeBlocks: data.codeBlocks,
        visionResult: data.visionResult,
      };
      const userMsg: VoiceMessage = { role: 'user', content: userMessage };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      historyRef.current = [...historyRef.current, userMsg, assistantMsg];
      setLastResponse(data.voiceResponse || data.response);

      speak(data.voiceResponse || data.response, () => {
        if (shouldListenRef.current) startListeningRef.current();
      });
    } catch {
      const errorMsg: VoiceMessage = { role: 'assistant', content: 'Network glitch, Boss. Try again.' };
      setMessages((prev) => [...prev, errorMsg]);
      speak('Network glitch, Boss. Try again.', () => {
        if (shouldListenRef.current) startListeningRef.current();
      });
    }
  }, [speak]);

  useEffect(() => {
    processMessageRef.current = processMessage;
  }, [processMessage]);

  const activate = useCallback(() => {
    if (isActive) return;
    setIsActive(true);
    shouldListenRef.current = true;

    const greeting = 'Good to see you, Boss. All systems online. What do you need me to handle?';
    const msg: VoiceMessage = { role: 'assistant', content: greeting };
    setMessages([msg]);
    historyRef.current = [msg];
    setLastResponse(greeting);
    speak(greeting, () => startListening());
  }, [isActive, speak, startListening]);

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

  const toolIcon = (tool?: string) => {
    switch (tool) {
      case 'search': return <Globe className="w-3 h-3 text-green-400" />;
      case 'image': return <ImageIcon className="w-3 h-3 text-purple-400" />;
      case 'code': return <Code className="w-3 h-3 text-amber-400" />;
      case 'vision': return <Eye className="w-3 h-3 text-pink-400" />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Results Panel (right side overlay) */}
      {activeResult && (
        <div className="absolute top-0 right-0 bottom-0 w-[45%] bg-black/90 border-l border-cyan-500/20 z-20 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,200,255,0.3) transparent' }}>
          <div className="flex items-center justify-between p-3 border-b border-cyan-500/10">
            <div className="flex items-center gap-2">
              {toolIcon(activeResult.tool)}
              <span className="text-cyan-400 font-mono text-xs tracking-wider">
                {activeResult.tool === 'search' ? 'SEARCH RESULTS' :
                 activeResult.tool === 'image' ? 'GENERATED IMAGE' :
                 activeResult.tool === 'code' ? 'CODE OUTPUT' :
                 activeResult.tool === 'vision' ? 'VISION ANALYSIS' : 'RESULT'}
              </span>
            </div>
            <button onClick={() => setActiveResult(null)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-3">
            {/* Generated Image */}
            {activeResult.generatedImage && (
              <div className="rounded-lg overflow-hidden border border-cyan-500/20">
                <img src={activeResult.generatedImage} alt="Generated" className="w-full" />
              </div>
            )}
            {/* Search Results */}
            {activeResult.searchResults?.map((r, i) => (
              <div key={i} className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/50">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-sm hover:underline">{r.name}</a>
                <p className="text-gray-400 text-xs mt-1">{r.snippet}</p>
              </div>
            ))}
            {/* Code Blocks */}
            {activeResult.codeBlocks?.map((block, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-gray-800/50">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/80 border-b border-gray-800/50">
                  <span className="text-gray-500 font-mono text-xs">{block.language}</span>
                  <button onClick={() => copyCode(block.code, i)} className="text-gray-500 hover:text-cyan-400">
                    {copiedIndex === i ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto text-xs text-gray-300 font-mono leading-relaxed bg-black/40" style={{ scrollbarWidth: 'thin' }}>
                  <code>{block.code}</code>
                </pre>
              </div>
            ))}
            {/* Vision Result */}
            {activeResult.visionResult && (
              <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/50">
                <p className="text-gray-300 text-sm leading-relaxed">{activeResult.visionResult}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Voice Area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* State Indicator */}
        <div className="text-center mb-2">
          {state === 'listening' && (
            <div className="flex items-center justify-center gap-3">
              <div className="flex gap-1 items-end">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-1.5 bg-cyan-400 rounded-full animate-pulse"
                    style={{ height: `${6 + Math.random() * 20}px`, animationDelay: `${i * 0.08}s`, animationDuration: `${0.3 + Math.random() * 0.4}s` }}
                  />
                ))}
              </div>
              <span className="text-cyan-400 font-mono text-xs tracking-wider animate-pulse">LISTENING</span>
            </div>
          )}
          {state === 'thinking' && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-cyan-400/70 font-mono text-xs tracking-wider">PROCESSING</span>
            </div>
          )}
          {state === 'speaking' && (
            <div className="flex items-center justify-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-cyan-400/70 font-mono text-xs tracking-wider">SPEAKING</span>
            </div>
          )}
        </div>

        {/* Transcript */}
        {transcript && state === 'listening' && (
          <div className="mb-3 text-center px-8">
            <p className="text-cyan-100/80 text-sm font-mono">{transcript}</p>
          </div>
        )}

        {/* Last Response */}
        {lastResponse && state === 'speaking' && (
          <div className="mb-3 text-center px-8 max-w-lg">
            <p className="text-gray-300 text-sm leading-relaxed font-mono">{lastResponse}</p>
          </div>
        )}

        {/* Activate or Active */}
        {!isActive ? (
          <button onClick={activate} className="group relative flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center transition-all group-hover:bg-cyan-500/20 group-hover:border-cyan-400/50 group-hover:scale-105">
                <Mic className="w-8 h-8 text-cyan-400 transition-all group-hover:text-cyan-300" />
              </div>
              <div className="absolute inset-0 w-24 h-24 rounded-full border border-cyan-400/20 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-cyan-400 font-mono text-sm tracking-wider">TAP TO ACTIVATE</p>
              <p className="text-gray-600 font-mono text-xs mt-1">Click to start voice session</p>
            </div>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                state === 'listening' ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,200,255,0.3)]' :
                state === 'thinking' ? 'bg-amber-500/10 border-2 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]' :
                state === 'speaking' ? 'bg-purple-500/10 border-2 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]' :
                'bg-cyan-500/10 border-2 border-cyan-500/20'
              }`}>
                {state === 'listening' && <Mic className="w-8 h-8 text-cyan-300" />}
                {state === 'thinking' && <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
                {state === 'speaking' && <Volume2 className="w-8 h-8 text-purple-300 animate-pulse" />}
                {state === 'idle' && <Mic className="w-8 h-8 text-cyan-400/50" />}
              </div>
              {state === 'listening' && <div className="absolute inset-0 w-24 h-24 rounded-full border border-cyan-400/30 animate-ping" />}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggleMute} className={`p-2.5 rounded-lg transition-all ${muted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-cyan-400'}`} title={muted ? 'Unmute' : 'Mute'}>
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button onClick={deactivate} className="p-2.5 rounded-lg bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-red-400 hover:border-red-500/30 transition-all" title="Deactivate">
                <MicOff className="w-4 h-4" />
              </button>
            </div>

            <p className="text-gray-600 font-mono text-[10px] tracking-wider">
              {state === 'listening' ? 'SPEAK NOW' : state === 'thinking' ? 'PROCESSING...' : state === 'speaking' ? 'SPEAKING...' : 'STANDBY'}
            </p>
          </div>
        )}
      </div>

      {/* Conversation History Bar */}
      {messages.length > 1 && (
        <div className="border-t border-cyan-500/10 bg-black/60 px-4 py-2 max-h-28 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,200,255,0.2) transparent' }}>
          {messages.slice(-8).map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 py-1 cursor-pointer hover:bg-cyan-500/5 rounded px-1 ${msg.role === 'user' ? '' : ''}`}
              onClick={() => {
                if (msg.role === 'assistant' && (msg.searchResults || msg.generatedImage || msg.codeBlocks || msg.visionResult)) {
                  setActiveResult(msg);
                }
              }}
            >
              {msg.role === 'assistant' && toolIcon(msg.tool)}
              <span className={`text-xs font-mono leading-relaxed ${msg.role === 'user' ? 'text-cyan-400/50' : 'text-gray-500/50'}`}>
                {msg.role === 'user' ? '> ' : ''}
                {msg.content.length > 80 ? msg.content.slice(0, 80) + '...' : msg.content}
                {msg.role === 'assistant' && (msg.searchResults || msg.generatedImage || msg.codeBlocks || msg.visionResult) && (
                  <span className="text-cyan-400/30 ml-1">[click to view]</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
