"use client";

import React, { useState } from "react";
import { 
  X, 
  Save, 
  Trash2, 
  Heart, 
  Target, 
  Sun, 
  Moon, 
  Laptop, 
  Sparkles, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ExternalLink 
} from "lucide-react";
import { AthleteSettings } from "../types";
import { useTheme } from "../context/ThemeContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  athlete: AthleteSettings | null;
  onSave: (settings: Partial<AthleteSettings>) => Promise<void>;
  onClearData: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  athlete,
  onSave,
  onClearData,
}) => {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(athlete?.athlete_name || "Corredor");
  const [maxHr, setMaxHr] = useState(athlete?.max_hr || 190);
  const [restHr, setRestHr] = useState(athlete?.rest_hr || 55);
  const [targetDist, setTargetDist] = useState(athlete?.target_distance || "10k");
  const [targetTime, setTargetTime] = useState(athlete?.target_time_minutes || 50.0);
  const [geminiKey, setGeminiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [testResult, setTestResult] = useState<{ valid?: boolean; message?: string; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!isOpen) return null;

  const handleTestGeminiKey = async () => {
    setIsValidating(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/gemini/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: geminiKey.trim() || undefined }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ valid: false, error: "Erro ao conectar ao servidor local." });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: Partial<AthleteSettings> = {
        athlete_name: name,
        max_hr: Number(maxHr),
        rest_hr: Number(restHr),
        target_distance: targetDist,
        target_time_minutes: Number(targetTime),
      };
      if (geminiKey.trim()) {
        payload.gemini_api_key = geminiKey.trim();
      }
      await onSave(payload);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await onClearData();
    setConfirmClear(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          Configurações do Atleta & Sistema
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Personalize sua frequência cardíaca máxima, metas e tema de exibição.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Theme selector option */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              Tema Visual
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 font-semibold transition ${
                  theme === "light"
                    ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Claro</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 font-semibold transition ${
                  theme === "dark"
                    ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-slate-400" />
                <span>Escuro</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 font-semibold transition ${
                  theme === "system"
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Laptop className="w-3.5 h-3.5 text-cyan-500" />
                <span>Sistema</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Nome ou Apelido
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center space-x-1">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>FC Máxima (bpm)</span>
              </label>
              <input
                type="number"
                min="130"
                max="230"
                value={maxHr}
                onChange={(e) => setMaxHr(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                Padrão aproximado: 220 - idade
              </span>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                FC Repouso (bpm)
              </label>
              <input
                type="number"
                min="35"
                max="100"
                value={restHr}
                onChange={(e) => setRestHr(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                Ao acordar pela manhã
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center space-x-1">
                <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Distância Foco</span>
              </label>
              <select
                value={targetDist}
                onChange={(e) => setTargetDist(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
              >
                <option value="5k">5 km</option>
                <option value="10k">10 km</option>
                <option value="21k">Meia Maratona (21.1 km)</option>
                <option value="42k">Maratona (42.2 km)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Meta de Tempo (minutos)
              </label>
              <input
                type="number"
                step="0.5"
                value={targetTime}
                onChange={(e) => setTargetTime(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                Ex: 48.0 = 48 minutos
              </span>
            </div>
          </div>

          {/* Gemini AI API Key Section */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5 border border-emerald-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 dark:text-slate-200 font-bold flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>Chave Google Gemini API (Coach IA)</span>
              </label>

              {athlete?.gemini_api_key_configured && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Configurada ({athlete.gemini_api_key_masked})</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Necessária para gerar o diagnóstico com inteligência artificial, avaliar a fisiologia dos treinos e prescrever o plano de 14 dias.
            </p>

            <div className="space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  placeholder={athlete?.gemini_api_key_configured ? "Substituir chave existente..." : "Cole aqui sua chave AIzaSy..."}
                  value={geminiKey}
                  onChange={(e) => {
                    setGeminiKey(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Action and feedback row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1 font-semibold"
                >
                  <span>Obter chave gratuita no Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="button"
                  disabled={isValidating || (!geminiKey.trim() && !athlete?.gemini_api_key_configured)}
                  onClick={handleTestGeminiKey}
                  className="py-1 px-2.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 disabled:opacity-50 transition flex items-center space-x-1"
                >
                  {isValidating ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                      <span>Testando...</span>
                    </>
                  ) : (
                    <span>Testar Conexão</span>
                  )}
                </button>
              </div>

              {/* Test response message */}
              {testResult && (
                <div
                  className={`p-2 rounded-xl text-[11px] font-medium border flex items-center space-x-1.5 ${
                    testResult.valid
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30"
                      : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-500/30"
                  }`}
                >
                  {testResult.valid ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <span>{testResult.message || testResult.error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
              className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center space-x-1.5 transition ${
                confirmClear
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{confirmClear ? "Confirmar Limpeza de Dados?" : "Limpar Corridas"}</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="py-2 px-4 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center space-x-1.5 transition shadow-md shadow-emerald-500/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
