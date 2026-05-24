'use client';

import { useEffect, useState } from 'react';
import { Cpu, HardDrive, Wifi, Shield, Zap, Activity } from 'lucide-react';

interface SystemMetric {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
}

export default function SystemStatus() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    { label: 'CPU', value: 23, unit: '%', icon: <Cpu className="w-3.5 h-3.5" />, color: 'cyan' },
    { label: 'Memory', value: 41, unit: '%', icon: <HardDrive className="w-3.5 h-3.5" />, color: 'purple' },
    { label: 'Network', value: 98, unit: '%', icon: <Wifi className="w-3.5 h-3.5" />, color: 'green' },
    { label: 'Security', value: 100, unit: '%', icon: <Shield className="w-3.5 h-3.5" />, color: 'amber' },
    { label: 'Power', value: 87, unit: '%', icon: <Zap className="w-3.5 h-3.5" />, color: 'pink' },
    { label: 'Uptime', value: 99, unit: '%', icon: <Activity className="w-3.5 h-3.5" />, color: 'emerald' },
  ]);

  const [activeNodes, setActiveNodes] = useState(47);
  const [latency, setLatency] = useState(12);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => {
          let fluctuation = 0;
          if (m.label === 'CPU') fluctuation = (Math.random() - 0.5) * 10;
          else if (m.label === 'Memory') fluctuation = (Math.random() - 0.5) * 5;
          else if (m.label === 'Network') fluctuation = (Math.random() - 0.5) * 3;
          else if (m.label === 'Power') fluctuation = (Math.random() - 0.5) * 4;
          else fluctuation = (Math.random() - 0.5) * 2;
          return { ...m, value: Math.min(100, Math.max(0, Math.round(m.value + fluctuation))) };
        })
      );
      setActiveNodes(45 + Math.floor(Math.random() * 5));
      setLatency(8 + Math.floor(Math.random() * 10));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
    pink: 'text-pink-400',
    emerald: 'text-emerald-400',
  };

  const barColorMap: Record<string, string> = {
    cyan: 'bg-cyan-400',
    purple: 'bg-purple-400',
    green: 'bg-green-400',
    amber: 'bg-amber-400',
    pink: 'bg-pink-400',
    emerald: 'bg-emerald-400',
  };

  const barBgMap: Record<string, string> = {
    cyan: 'bg-cyan-400/10',
    purple: 'bg-purple-400/10',
    green: 'bg-green-400/10',
    amber: 'bg-amber-400/10',
    pink: 'bg-pink-400/10',
    emerald: 'bg-emerald-400/10',
  };

  return (
    <div className="h-full flex flex-col bg-black/40 rounded-lg border border-cyan-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-black/60 border-b border-cyan-500/20">
        <Activity className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-cyan-400 font-mono text-sm tracking-wider">SYSTEM STATUS</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,200,255,0.3) transparent' }}>
        {/* Metrics */}
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={colorMap[metric.color]}>{metric.icon}</span>
                <span className="text-gray-400 font-mono text-xs">{metric.label}</span>
              </div>
              <span className={`font-mono text-xs ${colorMap[metric.color]}`}>
                {metric.value}{metric.unit}
              </span>
            </div>
            <div className={`h-1.5 rounded-full ${barBgMap[metric.color]} overflow-hidden`}>
              <div
                className={`h-full rounded-full ${barColorMap[metric.color]} transition-all duration-700`}
                style={{ width: `${metric.value}%` }}
              />
            </div>
          </div>
        ))}

        {/* Divider */}
        <div className="border-t border-cyan-500/10 pt-3 mt-3">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono text-xs">Active Nodes</span>
              <span className="text-green-400 font-mono text-xs">{activeNodes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono text-xs">Latency</span>
              <span className="text-cyan-400 font-mono text-xs">{latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono text-xs">Encryption</span>
              <span className="text-emerald-400 font-mono text-xs">AES-256</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-mono text-xs">Protocol</span>
              <span className="text-purple-400 font-mono text-xs">TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Threat Level */}
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-mono text-xs">Threat Level</span>
            <span className="text-emerald-400 font-mono text-xs font-bold">NONE</span>
          </div>
          <div className="flex gap-1 mt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i === 0 ? 'bg-emerald-400' : 'bg-gray-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
