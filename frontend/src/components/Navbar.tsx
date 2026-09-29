"use client";

import React from "react";
import { Flame, UploadCloud, Settings, Sparkles } from "lucide-react";
import { AthleteSettings } from "../types";
import { ThemeToggle } from "./ThemeToggle";

interface NavbarProps {
  athlete: AthleteSettings | null;
  totalRuns: number;
  onOpenConnect: () => void;
  onOpenSettings: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  athlete,
  totalRuns,
  onOpenConnect,
  onOpenSettings,
  onLoadSample,
  isLoading,
}) => {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Flame className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
                librun
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                Strava Coach
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Inteligência & Otimização de Performance
            </p>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Sample Seeder */}
          <button
            onClick={onLoadSample}
            disabled={isLoading}
            title="Carregar 10 semanas de corridas realistas para teste rápido"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">Dados de Exemplo</span>
          </button>

          {/* Connect / Upload Button */}
          <button
            onClick={onOpenConnect}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-md shadow-emerald-500/20 transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Sincronizar Strava</span>
          </button>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Ajustar zonas de frequência cardíaca e metas"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Athlete avatar badge */}
          <div className="hidden lg:flex items-center pl-2 border-l border-slate-200 dark:border-slate-800 space-x-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {athlete?.athlete_name ? athlete.athlete_name[0].toUpperCase() : "C"}
            </div>
            <div className="text-left leading-none">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block">
                {athlete?.athlete_name || "Corredor"}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {totalRuns} {totalRuns === 1 ? "corrida" : "corridas"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
