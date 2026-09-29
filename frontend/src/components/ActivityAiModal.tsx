"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  X, 
  Sparkles, 
  BrainCircuit, 
  RefreshCw, 
  AlertCircle,
  Copy,
  Check
} from "lucide-react";
import { Activity, AthleteSettings } from "../types";

interface ActivityAiModalProps {
  activity: Activity | null;
  athlete: AthleteSettings | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const ActivityAiModal: React.FC<ActivityAiModalProps> = ({
  activity,
  athlete,
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isKeyConfigured = athlete?.gemini_api_key_configured;

  const loadAnalysis = useCallback(async (refresh: boolean = false) => {
    if (!activity) return;
    setIsLoading(true);
    setError(null);
    try {
      const id = String(activity.strava_id || activity.id);
      const url = `/api/ai/activity/${id}${refresh ? "?force_refresh=true" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.detail || data.error || "Não foi possível analisar esta atividade.");
      }
    } catch {
      setError("Erro ao conectar com o serviço de IA.");
    } finally {
      setIsLoading(false);
    }
  }, [activity]);

  useEffect(() => {
    if (!isOpen || !activity) {
      setAnalysis(null);
      setError(null);
      return;
    }

    if (isKeyConfigured) {
      loadAnalysis(false);
    }
  }, [isOpen, activity, isKeyConfigured, loadAnalysis]);

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !activity) return null;

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "";
    try {
      return new Date(isoStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoStr.slice(0, 10);
    }
  };

  const formatPace = (spd?: number) => {
    if (!spd || spd <= 0) return "--:--";
    const sec = 1000 / spd;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")} /km`;
  };

  const formatTime = (totalSec: number) => {
    const sec = Math.max(0, Math.round(totalSec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h > 0) return `${h}h ${remM}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative my-8 space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start space-x-3 pr-10">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 font-bold shrink-0">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                Raio-X com Inteligência Artificial
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold uppercase border border-emerald-500/20">
                Gemini
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activity.name} • {formatDate(activity.start_date || activity.start_date_local)}
            </p>
          </div>
        </div>

        {/* Quick Telemetry Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center text-xs">
          <div className="bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Distância</span>
            <strong className="text-slate-900 dark:text-slate-100 font-extrabold text-sm">
              {(activity.distance / 1000).toFixed(2)} km
            </strong>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Ritmo (Pace)</span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
              {formatPace(activity.average_speed || (activity.distance / activity.moving_time))}
            </strong>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Tempo Total</span>
            <strong className="text-slate-900 dark:text-slate-100 font-extrabold text-sm">
              {formatTime(activity.moving_time)}
            </strong>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">FC Média</span>
            <strong className="text-rose-600 dark:text-rose-400 font-extrabold text-sm">
              {activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : "--"}
            </strong>
          </div>
        </div>

        {/* Content Area */}
        <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3 pt-2">
          {!isKeyConfigured ? (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Chave da API Gemini não configurada
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                Adicione sua chave gratuita do Google Gemini para desbloquear análises fisiológicas detalhadas de cada uma das suas corridas.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20 transition inline-flex items-center space-x-1.5"
              >
                <span>Configurar Chave Gemini</span>
              </button>
            </div>
          ) : isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-center">
              <Sparkles className="w-7 h-7 animate-spin text-emerald-500" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Analisando telemetria da corrida com o Gemini...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 text-xs text-red-800 dark:text-red-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : analysis ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {analysis}
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        {isKeyConfigured && analysis && !isLoading && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={handleCopy}
              className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Análise</span>
                </>
              )}
            </button>

            <button
              onClick={() => loadAnalysis(true)}
              className="py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reanalisar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
