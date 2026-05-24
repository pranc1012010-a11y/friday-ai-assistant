'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
}

type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function VoiceAgent() {
  const [state, setState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [muted, setMuted] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const historyRef = useRef<VoiceMessage[]>([]);
  const shouldListenRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  // Initialize speech synthesis
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
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    } else {
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
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => {
      setState('listening');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscript || interim);
    };

    recognition.onend = () => {
      if (finalTranscript.trim()) {
        // Send to API
        setState('thinking');
        setTranscript('');

        const userMessage = finalTranscript.trim();
        const history = historyRef.current.map((m) => ({ role: m.role, content: m.content }));

        let searchQuery = '';
        const searchPatterns = [
          /(?:search|look up|find|google|what('s| is) (?:the|today's|current)|latest|news|weather|price|stock|who|when|where)/i,
        ];
        const shouldSearch = searchPatterns.some((p) => p.test(userMessage));
        if (shouldSearch) {
          searchQuery = userMessage;
        }

        fetch('/api/friday', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage, history, searchQuery: searchQuery || undefined }),
        })
          .then((res) => res.json())
          .then((data) => {
            const response = data.response || 'Systems experiencing interference, Boss. Stand by.';
            const assistantMsg: VoiceMessage = { role: 'assistant', content: response };
            const userMsg: VoiceMessage = { role: 'user', content: userMessage };

            setMessages((prev) => [...prev, userMsg, assistantMsg]);
            historyRef.current = [...historyRef.current, userMsg, assistantMsg];
            setLastResponse(response);

            speak(response, () => {
              if (shouldListenRef.current) {
                startListeningRef.current();
              }
            });
          })
          .catch(() => {
            const errorMsg: VoiceMessage = {
              role: 'assistant',
              content: 'I hit a network glitch, Boss. Try again.',
            };
            setMessages((prev) => [...prev, errorMsg]);
            setLastResponse(errorMsg.content);
            speak(errorMsg.content, () => {
              if (shouldListenRef.current) {
                startListeningRef.current();
              }
            });
          });
      } else if (shouldListenRef.current) {
        setState('idle');
        setTimeout(() => {
          if (shouldListenRef.current) startListeningRef.current();
        }, 500);
      } else {
        setState('idle');
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' && shouldListenRef.current) {
        setState('idle');
        setTimeout(() => {
          if (shouldListenRef.current) startListeningRef.current();
        }, 500);
      } else {
        setState('idle');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [speak]);

  // Keep ref in sync
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const activate = useCallback(() => {
    if (isActive) return;
    setIsActive(true);
    shouldListenRef.current = true;

    const greeting = 'Good to see you, Boss. All systems are online. What do you need me to handle?';
    const msg: VoiceMessage = { role: 'assistant', content: greeting };
    setMessages([msg]);
    historyRef.current = [msg];
    setLastResponse(greeting);
    speak(greeting, () => {
      startListening();
    });
  }, [isActive, speak, startListening]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setState('idle');
    setTranscript('');
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (!prev && synthRef.current) {
        synthRef.current.cancel();
      }
      return !prev;
    });
  }, []);

  // Load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !synthRef.current) return;
    const loadVoices = () => {
      synthRef.current!.getVoices();
    };
    loadVoices();
    synthRef.current.onvoiceschanged = loadVoices;
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center relative">
      {/* State Indicator */}
      <div className="absolute top-4 left-0 right-0 text-center">
        {state === 'listening' && (
          <div className="flex items-center justify-center gap-3">
            <div className="flex gap-1 items-end">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-cyan-400 rounded-full animate-pulse"
                  style={{
                    height: `${6 + Math.random() * 20}px`,
                    animationDelay: `${i * 0.08}s`,
                    animationDuration: `${0.3 + Math.random() * 0.4}s`,
                  }}
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

      {/* Transcript Display */}
      {transcript && state === 'listening' && (
        <div className="absolute top-16 left-4 right-4 text-center">
          <p className="text-cyan-100/80 text-sm font-mono">{transcript}</p>
        </div>
      )}

      {/* Last Response */}
      {lastResponse && state === 'speaking' && (
        <div className="absolute top-16 left-4 right-4 text-center max-w-md mx-auto">
          <p className="text-gray-300 text-sm leading-relaxed font-mono">{lastResponse}</p>
        </div>
      )}

      {/* Activate Button (shown when not active) */}
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
          {/* Active State - Core Pulse */}
          <div className="relative">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                state === 'listening'
                  ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,200,255,0.3)]'
                  : state === 'thinking'
                    ? 'bg-amber-500/10 border-2 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                    : state === 'speaking'
                      ? 'bg-purple-500/10 border-2 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                      : 'bg-cyan-500/10 border-2 border-cyan-500/20'
              }`}
            >
              {state === 'listening' && <Mic className="w-8 h-8 text-cyan-300" />}
              {state === 'thinking' && (
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              )}
              {state === 'speaking' && <Volume2 className="w-8 h-8 text-purple-300 animate-pulse" />}
              {state === 'idle' && <Mic className="w-8 h-8 text-cyan-400/50" />}
            </div>
            {state === 'listening' && (
              <div className="absolute inset-0 w-24 h-24 rounded-full border border-cyan-400/30 animate-ping" />
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-lg transition-all ${
                muted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-cyan-400'
              }`}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={deactivate}
              className="p-2.5 rounded-lg bg-gray-800/60 text-gray-500 border border-gray-700/50 hover:text-red-400 hover:border-red-500/30 transition-all"
              title="Deactivate"
            >
              <MicOff className="w-4 h-4" />
            </button>
          </div>

          <p className="text-gray-600 font-mono text-[10px] tracking-wider">
            {state === 'listening'
              ? 'SPEAK NOW'
              : state === 'thinking'
                ? 'PROCESSING...'
                : state === 'speaking'
                  ? 'SPEAKING...'
                  : 'STANDBY'}
          </p>
        </div>
      )}

      {/* Conversation History (subtle, at bottom) */}
      {messages.length > 1 && (
        <div
          className="absolute bottom-2 left-4 right-4 max-h-20 overflow-y-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {messages.slice(-4).map((msg, i) => (
            <div
              key={i}
              className={`text-xs font-mono leading-relaxed ${msg.role === 'user' ? 'text-cyan-400/40' : 'text-gray-500/40'}`}
            >
              {msg.role === 'user' ? '> ' : 'FRIDAY: '}
              {msg.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
