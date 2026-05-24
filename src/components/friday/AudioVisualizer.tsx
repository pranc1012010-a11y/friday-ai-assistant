'use client';

import { useEffect, useRef } from 'react';

export default function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 400;
    const height = 60;
    canvas.width = width;
    canvas.height = height;

    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const barCount = 48;
      const barWidth = width / barCount - 2;
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + 2);
        const wave1 = Math.sin(time * 0.03 + i * 0.15) * 0.5;
        const wave2 = Math.sin(time * 0.05 + i * 0.1) * 0.3;
        const wave3 = Math.sin(time * 0.02 + i * 0.2) * 0.2;
        const amplitude = (wave1 + wave2 + wave3) * height * 0.35;
        const barHeight = Math.abs(amplitude);

        const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
        gradient.addColorStop(0, 'rgba(0, 200, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 200, 255, 0.8)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
        ctx.fillRect(x, centerY, barWidth, barHeight);
      }

      // Center line
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      time++;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="w-full flex items-center gap-3 px-4">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
        <span className="text-pink-400/60 font-mono text-[10px] tracking-wider">AUDIO</span>
      </div>
      <canvas ref={canvasRef} className="flex-1 h-[60px]" />
      <span className="text-gray-600 font-mono text-[10px] shrink-0">48kHz</span>
    </div>
  );
}
