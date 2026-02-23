import { useEffect, useRef } from "react";

interface SpeedChartProps {
  speeds: number[];
  peakSpeed: number;
  color?: string;
}

export function SpeedChart({
  speeds,
  peakSpeed,
  color = "rgba(255, 255, 255, 1)",
}: Readonly<SpeedChartProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let resizeObserver: ResizeObserver | null = null;

    const draw = () => {
      const clientWidth = canvas.clientWidth;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = clientWidth * dpr;
      canvas.height = 100 * dpr;
      ctx.scale(dpr, dpr);

      const width = clientWidth;
      const height = 100;
      const barWidth = 4;
      const barGap = 10;
      const barSpacing = barWidth + barGap;

      const totalBars = Math.max(1, Math.floor((width + barGap) / barSpacing));
      const maxHeight = peakSpeed || Math.max(...speeds, 1);

      ctx.clearRect(0, 0, width, height);

      let r = 255,
        g = 255,
        b = 255;
      if (color.startsWith("#")) {
        let hex = color.replace("#", "");
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        r = Number.parseInt(hex.substring(0, 2), 16) || 255;
        g = Number.parseInt(hex.substring(2, 4), 16) || 255;
        b = Number.parseInt(hex.substring(4, 6), 16) || 255;
      } else if (color.startsWith("rgb")) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          r = Number.parseInt(matches[0]) || 255;
          g = Number.parseInt(matches[1]) || 255;
          b = Number.parseInt(matches[2]) || 255;
        }
      }
      const displaySpeeds = speeds.slice(-totalBars);

      for (let i = 0; i < totalBars; i++) {
        const x = i * barSpacing;
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.roundRect(x, 0, barWidth, height, 3);
        ctx.fill();

        if (i < displaySpeeds.length) {
          const speed = displaySpeeds[i] || 0;
          const filledHeight = (speed / maxHeight) * height;

          if (filledHeight > 0) {
            const gradient = ctx.createLinearGradient(
              0,
              height - filledHeight,
              0,
              height
            );

            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.7)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, height - filledHeight, barWidth, filledHeight, 3);
            ctx.fill();
          }
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    resizeObserver = new ResizeObserver(() => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      draw();
    });
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [speeds, peakSpeed, color]);

  return (
    <canvas ref={canvasRef} className="download-group__speed-chart-canvas" />
  );
}
