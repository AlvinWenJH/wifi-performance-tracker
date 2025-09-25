import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (event?: React.MouseEvent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, then system preference, default to dark
    const savedTheme = localStorage.getItem('wifi-tracker-theme') as Theme;
    if (savedTheme) {
      return savedTheme;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    return 'dark';
  });

  const toggleTheme = (event?: React.MouseEvent) => {
    // Capture the position of the toggle button for the animation
    if (event?.currentTarget) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
      const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100;

      // Set CSS custom properties for the animation
      document.documentElement.style.setProperty('--theme-toggle-x', `${x}%`);
      document.documentElement.style.setProperty('--theme-toggle-y', `${y}%`);
    }

    // Calculate the new theme first
    const newTheme = theme === 'light' ? 'dark' : 'light';

    // Check if View Transitions API is supported
    if (!document.startViewTransition) {
      // Fallback for browsers that don't support View Transitions API
      setTheme(newTheme);
      localStorage.setItem('wifi-tracker-theme', newTheme);
      return;
    }

    // Use View Transitions API for smooth animation
    document.startViewTransition(() => {
      // Apply the theme change synchronously
      document.documentElement.className = newTheme;
      setTheme(newTheme);
      localStorage.setItem('wifi-tracker-theme', newTheme);
    });
  };

  useEffect(() => {
    // Apply theme class to document root
    document.documentElement.className = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};