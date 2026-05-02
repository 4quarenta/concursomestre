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
import { ResponsiveContainer } from 'recharts';

type StableResponsiveContainerProps = {
  children: React.ReactElement;
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
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return undefined;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const nextIsReady = rect.width > 0 && rect.height > 0;

      setIsReady((currentIsReady) => (
        currentIsReady === nextIsReady ? currentIsReady : nextIsReady
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

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 overflow-hidden ${className}`.trim()}
      data-chart-ready={isReady ? 'true' : 'false'}
      style={{ height, minHeight }}
    >
      {isReady ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : fallback}
    </div>
  );
};

export default StableResponsiveContainer;
