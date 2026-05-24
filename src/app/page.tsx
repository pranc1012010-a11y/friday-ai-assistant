'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import CoreRing from '@/components/friday/CoreRing';
import Terminal from '@/components/friday/Terminal';
import ChatInterface from '@/components/friday/ChatInterface';
import SystemStatus from '@/components/friday/SystemStatus';
import AudioVisualizer from '@/components/friday/AudioVisualizer';

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function Home() {
  const mounted = useMounted();
  const [bootComplete, setBootComplete] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setBootComplete(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background grid effect */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,200,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,255,0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Ambient glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[200px] pointer-events-none" />

      {/* Main Layout */}
      <div className="relative z-10 h-screen flex flex-col">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-cyan-500/10 bg-black/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-400 font-mono text-sm tracking-[0.2em] font-bold">FRIDAY</span>
            </div>
            <span className="text-gray-700 font-mono text-xs">|</span>
            <span className="text-gray-500 font-mono text-xs">Stark Industries AI Division</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 font-mono text-xs">{currentTime}</span>
            <span className="text-gray-700 font-mono text-xs">|</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400/70 font-mono text-xs">ALL SYSTEMS NOMINAL</span>
            </div>
          </div>
        </header>

        {/* Audio Visualizer Strip */}
        <div className="border-b border-cyan-500/10 bg-black/40 py-1">
          <AudioVisualizer />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Terminal */}
          <div className="w-[340px] shrink-0 border-r border-cyan-500/10 p-2 hidden lg:block">
            <Terminal />
          </div>

          {/* Center Panel - Chat + Core */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Core Ring */}
            <div className="flex justify-center py-4 border-b border-cyan-500/10 bg-black/20">
              <CoreRing />
            </div>

            {/* Chat Interface */}
            <div className="flex-1 min-h-0 p-2">
              <ChatInterface />
            </div>
          </div>

          {/* Right Panel - System Status */}
          <div className="w-[280px] shrink-0 border-l border-cyan-500/10 p-2 hidden lg:block">
            <SystemStatus />
          </div>
        </div>

        {/* Bottom Bar */}
        <footer className="flex items-center justify-between px-6 py-2 border-t border-cyan-500/10 bg-black/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600 font-mono text-[10px]">FRIDAY OS v7.2.1</span>
            <span className="text-gray-700 font-mono text-[10px]">|</span>
            <span className="text-gray-600 font-mono text-[10px]">Kernel: Stark-RT 6.1</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 font-mono text-[10px]">Nodes: 47</span>
            <span className="text-gray-700 font-mono text-[10px]">|</span>
            <span className="text-gray-600 font-mono text-[10px]">Latency: 12ms</span>
            <span className="text-gray-700 font-mono text-[10px]">|</span>
            <span className="text-cyan-400/50 font-mono text-[10px]">Arc Reactor: Stable</span>
          </div>
        </footer>
      </div>

      {/* Boot Overlay */}
      {!bootComplete && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-1000">
          <div className="text-center space-y-4">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-cyan-400 font-mono text-sm tracking-[0.3em] animate-pulse">INITIALIZING FRIDAY</p>
          </div>
        </div>
      )}
    </div>
  );
}
