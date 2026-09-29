"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Sparkles, 
  RefreshCw, 
  Key, 
  BrainCircuit, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Copy,
  Check
} from "lucide-react";
import { AthleteSettings } from "../types";

interface GeminiCoachProps {
  athlete: AthleteSettings | null;
  onOpenSettings: () => void;
}

export const GeminiCoach: React.FC<GeminiCoachProps> = ({
  athlete,
  onOpenSettings,
}) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isKeyConfigured = Boolean(
    (typeof window !== "undefined" && localStorage.getItem("librun_gemini_api_key")) ||
    athlete?.gemini_api_key_configured
  );

  const fetchAnalysis = useCallback(async (refresh: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = refresh ? "/api/ai/coach/refresh" : "/api/ai/coach";
      const method = refresh ? "POST" : "GET";
      const localKey = typeof window !== "undefined" ? localStorage.getItem("librun_gemini_api_key") : null;
      const localModel = typeof window !== "undefined" ? localStorage.getItem("librun_gemini_model") : null;
      const localAthleteId = typeof window !== "undefined" ? localStorage.getItem("librun_strava_athlete_id") : null;
      const headers: Record<string, string> = {};
      if (localKey) headers["X-Gemini-Key"] = localKey;
      if (localModel) headers["X-Gemini-Model"] = localModel;
      else if (athlete?.gemini_model) headers["X-Gemini-Model"] = athlete.gemini_model;
      if (localAthleteId) headers["X-Athlete-Id"] = localAthleteId;
      else if (athlete?.athlete_id) headers["X-Athlete-Id"] = String(athlete.athlete_id);
      const res = await fetch(url, { method, headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalysis(data.analysis);
        setCreatedAt(data.created_at || "Agora");
      } else {
        setError(data.detail || data.error || "Não foi possível gerar a análise por IA.");
      }
    } catch {
      setError("Erro de comunicação com o servidor ao consultar o Gemini.");
    } finally {
      setIsLoading(false);
    }
  }, [athlete?.gemini_model, athlete?.athlete_id]);

  useEffect(() => {
    if (isKeyConfigured) {
      fetchAnalysis(false);
    }
  }, [isKeyConfigured, fetchAnalysis]);

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Helper to render markdown nicely without external heavyweight parser
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split("\n");
    return (
      <div className="space-y-3 leading-relaxed text-sm text-slate-800 dark:text-slate-200">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-2" />;
          }

          // Headers ###
          if (trimmed.startsWith("### ")) {
            return (
              <h4 key={idx} className="text-base font-extrabold text-slate-900 dark:text-slate-100 pt-3 pb-1 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-2">
                <span>{trimmed.replace("### ", "")}</span>
              </h4>
            );
          }
          // Headers ##
          if (trimmed.startsWith("## ")) {
            return (
              <h3 key={idx} className="text-lg font-black text-slate-900 dark:text-slate-100 pt-4 pb-1 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                {trimmed.replace("## ", "")}
              </h3>
            );
          }
          // Headers #
          if (trimmed.startsWith("# ")) {
            return (
              <h2 key={idx} className="text-xl font-black text-slate-900 dark:text-slate-100 pt-2 pb-1">
                {trimmed.replace("# ", "")}
              </h2>
            );
          }

          // Bullet points - or *
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const content = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start space-x-2 pl-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
              </div>
            );
          }

          // Numbered list 1. 2.
          if (/^\d+\.\s/.test(trimmed)) {
            return (
              <div key={idx} className="flex items-start space-x-2 pl-2 font-medium">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                  {trimmed.match(/^\d+\./)?.[0]}
                </span>
                <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace(/^\d+\.\s*/, "")) }} />
              </div>
            );
          }

          // Regular paragraph
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
          );
        })}
      </div>
    );
  };

  // Convert bold **text** to <strong>
  const formatInline = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-950 dark:text-slate-50">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-xs">$1</code>');
  };

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 font-bold">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-1.5">
              <span>Diagnóstico com Inteligência Artificial</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-extrabold uppercase">
                Google Gemini
              </span>
              {isKeyConfigured && (
                <button
                  onClick={onOpenSettings}
                  title="Clique para alterar o modelo do Gemini"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 font-mono hover:bg-cyan-500/20 transition cursor-pointer"
                >
                  {athlete?.gemini_model || "gemini-3.8-flash"}
                </button>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Análise fisiológica avançada com base no método 80/20, índice ACWR e histórico de treinos.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {isKeyConfigured ? (
            <>
              {analysis && (
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                  title="Copiar relatório"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => fetchAnalysis(true)}
                disabled={isLoading}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-sm shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>{isLoading ? "Analisando..." : "Atualizar com IA"}</span>
              </button>
            </>
          ) : (
            <button
              onClick={onOpenSettings}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-sm shadow-emerald-500/20 transition"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Configurar Chave Gemini</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner when key is not configured */}
      {!isKeyConfigured && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center sm:justify-start space-x-1.5">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>Ative a Inteligência Artificial no seu Treinamento</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg">
              Insira sua chave gratuita do Google Gemini API para receber diagnósticos fisiológicos aprofundados, análise de zonas cardíacas e plano de 14 dias para sua meta.
            </p>
          </div>

          <button
            onClick={onOpenSettings}
            className="shrink-0 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center space-x-2 shadow-md shadow-emerald-500/20 transition"
          >
            <Key className="w-4 h-4" />
            <span>Inserir Chave Gratuita</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Sparkles className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              O Treinador IA do Gemini está processando seu histórico...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-0.5">
              Calculando distribuição 80/20, índice ACWR, cadência e prescrevendo os próximos treinos.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Aviso ao consultar o Gemini:</span>
              <span className="whitespace-pre-line">{error}</span>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-200 font-semibold text-xs border border-red-300 dark:border-red-700/50 transition self-start sm:self-center"
          >
            Ajustar Modelo nas Configurações
          </button>
        </div>
      )}

      {/* Analysis Content */}
      {analysis && !isLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Gerado em: <strong>{createdAt}</strong></span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sincronizado com seus dados</span>
            </span>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            {renderFormattedMarkdown(analysis)}
          </div>
        </div>
      )}
    </div>
  );
};
