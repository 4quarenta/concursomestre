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

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const DEFAULT_THEME: Theme = 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provider oficial do tema global.
 * Centraliza sincronizacao com DOM e persistencia local no ponto canonico.
 * @since 1.0.0
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState(false);

  const applyThemeToDocument = useCallback((nextTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(nextTheme);
    root.style.colorScheme = nextTheme;
    localStorage.setItem('theme', nextTheme);
  }, []);

  /**
   * Resolve o tema inicial a partir do storage ou da preferencia do sistema.
   * @since 1.0.0
   */
  const [theme, setThemeState] = useState<Theme>(() => {
    return DEFAULT_THEME;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
        setIsHydrated(true);
        return;
      }

      setThemeState(DEFAULT_THEME);
      setIsHydrated(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  /**
   * Mantem DOM e localStorage sincronizados sempre que o tema mudar.
   * @since 1.0.0
   */
  useLayoutEffect(() => {
    if (!isHydrated) {
      return;
    }

    applyThemeToDocument(theme);
  }, [applyThemeToDocument, isHydrated, theme]);

  /**
   * Alterna entre os dois modos suportados pela plataforma.
   * @since 1.0.0
   */
  const setTheme = useCallback((nextTheme: Theme) => {
    setIsHydrated(true);
    setThemeState(nextTheme);
    applyThemeToDocument(nextTheme);
  }, [applyThemeToDocument]);

  const toggleTheme = useCallback(() => {
    const root = window.document.documentElement;
    root.classList.add('theme-switching');

    setThemeState((prev) => {
      const nextTheme = prev === 'light' ? 'dark' : 'light';
      applyThemeToDocument(nextTheme);
      return nextTheme;
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });
  }, [applyThemeToDocument]);

  const visibleTheme = isHydrated ? theme : 'light';

  return (
    <ThemeContext.Provider value={{ theme: visibleTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook público para acesso ao tema global.
 * @since 1.0.0
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
