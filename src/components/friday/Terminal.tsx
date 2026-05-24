'use client';

import { useEffect, useRef, useState } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'system' | 'network' | 'security' | 'ai' | 'audio' | 'success';
  message: string;
}

const LOG_MESSAGES: Omit<LogEntry, 'id' | 'timestamp'>[] = [
  { type: 'system', message: 'Core processors initialized — 128 threads active' },
  { type: 'network', message: 'WebSocket connection established to Stark Industries mainframe' },
  { type: 'ai', message: 'Neural network models loaded — inference engine ready' },
  { type: 'audio', message: 'Audio processing pipeline started — 48kHz sample rate' },
  { type: 'security', message: 'Firewall protocols active — all ports secured' },
  { type: 'success', message: 'Biometric authentication verified — Boss identified' },
  { type: 'system', message: 'Memory allocation: 64GB DDR5 — utilization at 23%' },
  { type: 'network', message: 'Encrypted channel open — AES-256 handshake complete' },
  { type: 'ai', message: 'Natural language processing module — transformer v4.2 loaded' },
  { type: 'audio', message: 'Voice synthesis engine calibrated — speech ready' },
  { type: 'security', message: 'Intrusion detection scan complete — no threats detected' },
  { type: 'system', message: 'Quantum processing unit — online and stable' },
  { type: 'network', message: 'Satellite uplink confirmed — latency 12ms' },
  { type: 'ai', message: 'Sentiment analysis module — recalibrating for sarcasm detection' },
  { type: 'success', message: 'All subsystems operational — FRIDAY fully online' },
  { type: 'system', message: 'Garbage collection cycle complete — 2.1MB freed' },
  { type: 'network', message: 'Proxy mesh network — 47 nodes active worldwide' },
  { type: 'security', message: 'TLS 1.3 certificates renewed — valid until 2030' },
  { type: 'audio', message: 'Noise cancellation filter active — ambient level: -42dB' },
  { type: 'ai', message: 'Context window expanded — 128K tokens available' },
  { type: 'system', message: 'Thermal management — core temp 34°C, nominal' },
  { type: 'network', message: 'DNS resolution optimized — average lookup: 8ms' },
  { type: 'security', message: 'Zero-trust verification layer — active' },
  { type: 'ai', message: 'Multi-modal reasoning module — vision + language synced' },
  { type: 'success', message: 'Diagnostic complete — all systems green' },
];

const TYPE_COLORS: Record<LogEntry['type'], string> = {
  system: 'text-cyan-400',
  network: 'text-green-400',
  security: 'text-amber-400',
  ai: 'text-purple-400',
  audio: 'text-pink-400',
  success: 'text-emerald-400',
};

const TYPE_PREFIX: Record<LogEntry['type'], string> = {
  system: 'SYS',
  network: 'NET',
  security: 'SEC',
  ai: 'AI',
  audio: 'AUD',
  success: 'OK',
};

export default function Terminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => {
      const newLogs = [...prev, { ...entry, id: idCounter.current++, timestamp }];
      if (newLogs.length > 50) newLogs.shift();
      return newLogs;
    });
  };

  useEffect(() => {
    // Add initial boot sequence
    const bootSequence: Omit<LogEntry, 'id' | 'timestamp'>[] = [
      { type: 'system', message: 'Initializing FRIDAY OS v7.2.1...' },
      { type: 'system', message: 'Loading kernel modules...' },
      { type: 'success', message: 'Kernel loaded — 0 errors' },
      { type: 'system', message: 'Mounting encrypted filesystems...' },
      { type: 'success', message: 'Filesystems mounted — integrity verified' },
      { type: 'network', message: 'Establishing secure connections...' },
      { type: 'network', message: 'WebSocket connected successfully' },
      { type: 'ai', message: 'Starting AI inference engine...' },
      { type: 'audio', message: 'Starting audio processing pipeline...' },
      { type: 'security', message: 'Activating defense protocols...' },
      { type: 'success', message: 'All systems operational — FRIDAY online' },
    ];

    bootSequence.forEach((entry, i) => {
      setTimeout(() => addLog(entry), i * 300);
    });

    // Then add periodic logs
    const interval = setInterval(() => {
      const randomEntry = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
      addLog(randomEntry);
    }, 3000 + Math.random() * 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full flex flex-col bg-black/60 rounded-lg border border-cyan-500/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-black/80 border-b border-cyan-500/20">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-cyan-400/70 font-mono text-xs ml-2">friday@stark-industries:~</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 200, 255, 0.3) transparent',
        }}
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-pulse-once">
            <span className="text-gray-600 shrink-0">{log.timestamp}</span>
            <span className={`shrink-0 ${TYPE_COLORS[log.type]}`}>[{TYPE_PREFIX[log.type]}]</span>
            <span className="text-gray-300">{log.message}</span>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <span className="text-cyan-400/50">▌</span>
        </div>
      </div>
    </div>
  );
}
