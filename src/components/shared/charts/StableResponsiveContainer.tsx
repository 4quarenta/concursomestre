'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';

type StableResponsiveContainerProps = {
  children: React.ReactElement<Record<string, unknown>>;
  className?: string;
  fallback?: React.ReactNode;
  height: number;
  minHeight?: number;
};

const StableResponsiveContainer: React.FC<StableResponsiveContainerProps> = ({
  children,
  className = '',
  fallback = null,
  height,
  minHeight = height,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return undefined;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const nextDimensions = {
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      };

      setDimensions((currentDimensions) => (
        currentDimensions.width === nextDimensions.width && currentDimensions.height === nextDimensions.height
          ? currentDimensions
          : nextDimensions
      ));
    };

    const frameId = window.requestAnimationFrame(measure);

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);

      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  const isReady = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 overflow-hidden ${className}`.trim()}
      data-chart-ready={isReady ? 'true' : 'false'}
      style={{ height, minHeight }}
    >
      {isReady ? (
        React.cloneElement(children, {
          width: dimensions.width,
          height: dimensions.height,
        })
      ) : fallback}
    </div>
  );
};

export default StableResponsiveContainer;
