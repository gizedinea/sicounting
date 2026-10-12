import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

function getInitialTheme() {
  const savedTheme = localStorage.getItem("sicounting-theme");

  if (savedTheme === "dark") {
    return "dark";
  }

  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    localStorage.setItem("sicounting-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      return currentTheme === "light" ? "dark" : "light";
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}