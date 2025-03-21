
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Get the initial theme from localStorage or default to light
  const [theme, setTheme] = useState<Theme>(() => {
    // Check for saved theme preference or use light as default
    const savedTheme = localStorage.getItem("theme") as Theme;
    return savedTheme || "light";
  });

  // Update the HTML class when theme changes
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove the old theme class and add the new one
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    
    // Save the theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Toggle between light and dark mode
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook for using the theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
