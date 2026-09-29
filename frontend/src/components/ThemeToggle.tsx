"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export const ThemeToggle: React.FC = () => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => toggleTheme()}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        title={`Tema atual: ${theme === "system" ? "Sistema" : resolvedTheme === "dark" ? "Escuro" : "Claro"}. Clique para alternar.`}
        aria-label="Alternar tema claro/escuro"
        className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors flex items-center justify-center relative group"
      >
        {resolvedTheme === "dark" ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform group-hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700 transition-transform group-hover:-rotate-12" />
        )}
      </button>

      {/* Menu dropdown if opened via settings or context */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
          <button
            onClick={() => {
              setTheme("light");
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
              theme === "light" ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
            }`}
          >
            <span className="flex items-center space-x-2">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Claro</span>
            </span>
            {theme === "light" && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => {
              setTheme("dark");
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
              theme === "dark" ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
            }`}
          >
            <span className="flex items-center space-x-2">
              <Moon className="w-3.5 h-3.5 text-slate-400" />
              <span>Escuro</span>
            </span>
            {theme === "dark" && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => {
              setTheme("system");
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
              theme === "system" ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
            }`}
          >
            <span className="flex items-center space-x-2">
              <Laptop className="w-3.5 h-3.5 text-cyan-500" />
              <span>Sistema</span>
            </span>
            {theme === "system" && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
