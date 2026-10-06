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
  ExternalLink,
  Cpu,
  RefreshCw
} from "lucide-react";
import { AthleteSettings, GeminiModelOption } from "../types";
import { useTheme } from "../context/ThemeContext";

const DEFAULT_GEMINI_MODELS: GeminiModelOption[] = [
  { id: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash (Mais Rápido & Estável - Recomendado)" },
  { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash (Mais Recente & Inteligente)" },
  { id: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro (Raciocínio Avançado)" },
  { id: "gemini-2.0-flash-lite", displayName: "Gemini 2.0 Flash-Lite (Super Rápido)" },
];

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
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("librun_gemini_api_key") || "";
    }
    return "";
  });
  const [geminiModel, setGeminiModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("librun_gemini_model");
      if (saved) return saved;
    }
    return athlete?.gemini_model || "gemini-1.5-flash";
  });
  const [availableModels, setAvailableModels] = useState<GeminiModelOption[]>(DEFAULT_GEMINI_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelStatusMsg, setModelStatusMsg] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [testResult, setTestResult] = useState<{ valid?: boolean; message?: string; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("librun_auto_sync") !== "false";
    }
    return true;
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("librun_gemini_model");
      if (saved) {
        setGeminiModel(saved);
        return;
      }
    }
    if (athlete?.gemini_model) {
      setGeminiModel(athlete.gemini_model);
    }
  }, [athlete]);

  // Close on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fetchAvailableModels = async () => {
    setIsLoadingModels(true);
    setModelStatusMsg(null);
    try {
      const keyToUse = geminiKey.trim() || undefined;
      const url = keyToUse
        ? `/api/gemini/models?api_key=${encodeURIComponent(keyToUse)}`
        : `/api/gemini/models`;
      const headers: Record<string, string> = {};
      if (keyToUse) {
        headers["X-Gemini-Key"] = keyToUse;
      }
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (res.ok && data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        setModelStatusMsg(`Carregados ${data.models.length} modelos compatíveis com sua chave.`);
      }
    } catch {
      setModelStatusMsg("Não foi possível listar modelos adicionais.");
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestGeminiKey = async () => {
    setIsValidating(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (geminiKey.trim()) {
        headers["X-Gemini-Key"] = geminiKey.trim();
      }
      const res = await fetch("/api/gemini/validate", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          api_key: geminiKey.trim() || undefined,
          chosen_model: geminiModel,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.available_models && data.available_models.length > 0) {
        setAvailableModels(data.available_models);
      }
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
      // Save Gemini key & model strictly to client LocalStorage (never to server database)
      if (typeof window !== "undefined") {
        if (geminiKey.trim()) {
          localStorage.setItem("librun_gemini_api_key", geminiKey.trim());
        } else {
          localStorage.removeItem("librun_gemini_api_key");
        }
        if (geminiModel) {
          localStorage.setItem("librun_gemini_model", geminiModel);
        }
        localStorage.setItem("librun_auto_sync", String(autoSync));
      }

      const payload: Partial<AthleteSettings> = {
        athlete_name: name,
        max_hr: Number(maxHr),
        rest_hr: Number(restHr),
        target_distance: targetDist,
        target_time_minutes: Number(targetTime),
        gemini_model: geminiModel,
      };
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar configurações"
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

          {/* Sincronização Automática */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="pr-3">
              <span className="text-slate-800 dark:text-slate-200 font-semibold block text-xs">
                Sincronizar Strava ao Iniciar
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                Mantém a sessão conectada e busca novas corridas automaticamente ao abrir o aplicativo.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAutoSync(val);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("librun_auto_sync", String(val));
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
            </label>
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

              {geminiKey.trim() ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Salva neste navegador (Local)</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Não configurada neste aparelho
                </span>
              )}
            </div>

            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-300 leading-tight">
              🔒 <strong>Privacidade Total (Armazenamento Local):</strong> Sua chave é armazenada exclusivamente na memória deste navegador (LocalStorage). Ela <strong>nunca é gravada no banco de dados do servidor</strong> e não é compartilhada com outros dispositivos ou usuários.
            </div>

            <div className="space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="Cole aqui sua chave AIzaSy... (salva apenas no aparelho)"
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

              {/* Gemini Model Selector */}
              <div className="pt-2.5 mt-2 border-t border-emerald-500/15 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-800 dark:text-slate-200 font-semibold flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Modelo de IA Selecionado</span>
                  </label>
                  <button
                    type="button"
                    onClick={fetchAvailableModels}
                    disabled={isLoadingModels || (!geminiKey.trim() && !athlete?.gemini_api_key_configured)}
                    title="Buscar lista de modelos suportados pela sua chave no Google"
                    className="text-[10px] text-cyan-700 dark:text-cyan-400 hover:underline flex items-center space-x-1 disabled:opacity-40 font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingModels ? "animate-spin" : ""}`} />
                    <span>{isLoadingModels ? "Consultando Google..." : "Buscar Modelos da Chave"}</span>
                  </button>
                </div>

                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 text-xs font-medium"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName || m.id}
                    </option>
                  ))}
                  {!availableModels.some((m) => m.id === geminiModel) && (
                    <option value={geminiModel}>{geminiModel} (Personalizado)</option>
                  )}
                </select>

                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-0.5">
                  <span>Recomendado: <b>gemini-flash-lite-latest</b> ou <b>gemini-3.5-flash</b></span>
                  <span>ID: <code className="text-emerald-600 dark:text-emerald-400 font-mono">{geminiModel}</code></span>
                </div>

                {modelStatusMsg && (
                  <div className="text-[10px] text-cyan-700 dark:text-cyan-400 italic">
                    {modelStatusMsg}
                  </div>
                )}
              </div>
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

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
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
          </div>
        </form>
      </div>
    </div>
  );
};
