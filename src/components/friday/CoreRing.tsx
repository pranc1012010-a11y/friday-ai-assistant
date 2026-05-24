'use client';

import { useEffect, useRef } from 'react';

export default function CoreRing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 280;
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;

    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Outer rotating ring
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(time * 0.005);
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rotating tick marks on outer ring
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const innerR = i % 3 === 0 ? 108 : 113;
        const outerR = 120;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(0, 200, 255, 0.5)' : 'rgba(0, 200, 255, 0.2)';
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();

      // Middle pulsing ring
      const pulseRadius = 90 + Math.sin(time * 0.03) * 5;
      ctx.beginPath();
      ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 200, 255, ${0.3 + Math.sin(time * 0.03) * 0.1})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner core glow
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, 70);
      gradient.addColorStop(0, 'rgba(0, 220, 255, 0.25)');
      gradient.addColorStop(0.4, 'rgba(0, 150, 255, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center, center, 70, 0, Math.PI * 2);
      ctx.fill();

      // Inner rotating segments
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(-time * 0.01);
      for (let i = 0; i < 6; i++) {
        const startAngle = (i / 6) * Math.PI * 2 + 0.05;
        const endAngle = startAngle + (Math.PI * 2) / 6 - 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, 55, startAngle, endAngle);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.4 + Math.sin(time * 0.05 + i) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();

      // Center dot
      const coreGradient = ctx.createRadialGradient(center, center, 0, center, center, 12);
      coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGradient.addColorStop(0.5, 'rgba(0, 220, 255, 0.6)');
      coreGradient.addColorStop(1, 'rgba(0, 150, 255, 0)');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(center, center, 12, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting particles
      for (let i = 0; i < 4; i++) {
        const orbitAngle = time * 0.02 + (i / 4) * Math.PI * 2;
        const orbitR = 75 + Math.sin(time * 0.04 + i) * 5;
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

      // Data arcs (sweeping radar-like effect)
      ctx.save();
      ctx.translate(center, center);
      const sweepAngle = time * 0.015;
      const sweepGrad = ctx.createConicGradient(sweepAngle, 0, 0);
      sweepGrad.addColorStop(0, 'rgba(0, 200, 255, 0.15)');
      sweepGrad.addColorStop(0.1, 'rgba(0, 200, 255, 0)');
      sweepGrad.addColorStop(1, 'rgba(0, 200, 255, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      time++;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <canvas ref={canvasRef} className="w-[280px] h-[280px]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-cyan-400 font-mono text-xs tracking-[0.3em] opacity-70 mt-1">FRIDAY</span>
      </div>
    </div>
  );
}
