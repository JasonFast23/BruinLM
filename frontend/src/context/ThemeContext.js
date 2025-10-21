import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('bruinlm-theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Save theme preference to localStorage
    localStorage.setItem('bruinlm-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

const themes = {
  light: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
      muted: '#94a3b8'
    },
    border: {
      primary: '#e2e8f0',
      secondary: '#cbd5e1'
    },
    sidebar: {
      background: '#f8fafc'
    },
    interactive: {
      hover: '#f1f5f9',
      active: '#e2e8f0'
    }
  },
  dark: {
    primary: '#36393f',      // Discord's main background
    secondary: '#2f3136',    // Discord's secondary background
    tertiary: '#40444b',     // Discord's tertiary/hover background
    text: {
      primary: '#dcddde',    // Discord's primary text
      secondary: '#b9bbbe',  // Discord's secondary text
      muted: '#72767d'       // Discord's muted text
    },
    border: {
      primary: '#202225',    // Discord's border color
      secondary: '#2f3136'   // Discord's secondary border
    },
    sidebar: {
      background: '#2f3136'  // Discord's sidebar background
    },
    interactive: {
      hover: '#40444b',      // Discord's hover state
      active: '#42464d'      // Discord's active state
    }
  }
};

  const theme = {
    colors: isDarkMode ? themes.dark : themes.light,
    isDarkMode,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};