"use client";

import React from "react";
import { CoachingInsight } from "../types";
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ArrowRight, 
  Sparkles, 
  Target, 
  Heart, 
  ShieldAlert, 
  Footprints, 
  TrendingUp, 
  Calendar 
} from "lucide-react";

interface CoachingInsightsProps {
  insights: CoachingInsight[];
}

export const CoachingInsights: React.FC<CoachingInsightsProps> = ({ insights }) => {
  if (!insights || insights.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
        <Sparkles className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-200">
          Nenhuma recomendação no momento
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Carregue mais atividades para gerar uma análise aprofundada dos seus pontos de melhoria.
        </p>
      </div>
    );
  }

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          border: "border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-950/20",
          badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
          icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />,
          label: "Ação Prioritária (Crítico)",
          actionBox: "bg-white/90 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-500/30 dark:text-red-200",
        };
      case "warning":
        return {
          border: "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/20",
          badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
          label: "Ponto de Atenção",
          actionBox: "bg-white/90 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-500/30 dark:text-amber-200",
        };
      case "good":
        return {
          border: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-950/20",
          badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          label: "Ponto Forte Confirmado",
          actionBox: "bg-white/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-200",
        };
      default:
        return {
          border: "border-cyan-200 bg-cyan-50/50 dark:border-cyan-500/30 dark:bg-cyan-950/20",
          badge: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30",
          icon: <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />,
          label: "Orientação Tática",
          actionBox: "bg-white/90 border-cyan-200 text-cyan-950 dark:bg-cyan-950/40 dark:border-cyan-500/30 dark:text-cyan-200",
        };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "intensidade":
        return <Heart className="w-3.5 h-3.5 mr-1 text-rose-500" />;
      case "carga":
        return <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-500" />;
      case "biomecanica":
        return <Footprints className="w-3.5 h-3.5 mr-1 text-cyan-600 dark:text-cyan-400" />;
      case "volume":
        return <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />;
      case "consistencia":
        return <Calendar className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400" />;
      default:
        return <Target className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <span>Onde Você Precisa Melhorar</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                {insights.length} diagnósticos
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Análise fisiológica baseada em dados reais de ritmo, carga e frequência cardíaca.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((item) => {
          const style = getSeverityStyle(item.severity);
          return (
            <div
              key={item.id}
              className={`rounded-2xl border ${style.border} p-5 flex flex-col justify-between transition hover:shadow-lg`}
            >
              <div>
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {getCategoryIcon(item.category)}
                    <span className="capitalize">{item.category}</span>
                  </div>
                  <span
                    className={`inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${style.badge}`}
                  >
                    {style.label}
                  </span>
                </div>

                {/* Title & Subtitle */}
                <div className="flex items-start space-x-3">
                  {style.icon}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Problem explanation */}
                {item.problem && (
                  <div className="mt-3 text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800/80 leading-relaxed">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                      🔍 Diagnóstico nos seus dados:
                    </span>
                    {item.problem}
                  </div>
                )}
              </div>

              {/* Action Plan */}
              <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/60 space-y-2">
                <div className={`rounded-xl p-3 text-xs border ${style.actionBox} leading-relaxed`}>
                  <div className="font-bold mb-1 flex items-center space-x-1.5">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span>O que fazer nos próximos treinos:</span>
                  </div>
                  {item.action}
                </div>

                {item.expected_gain && (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400/90 font-medium flex items-center space-x-1.5 px-1">
                    <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      <strong>Benefício:</strong> {item.expected_gain}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
