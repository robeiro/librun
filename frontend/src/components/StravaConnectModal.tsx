"use client";

import React, { useState } from "react";
import { X, UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, ExternalLink, Copy, Check } from "lucide-react";
import { AthleteSettings } from "../types";

interface StravaConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  athlete: AthleteSettings | null;
  onRefreshData: () => void;
}

export const StravaConnectModal: React.FC<StravaConnectModalProps> = ({
  isOpen,
  onClose,
  athlete,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<"oauth" | "file" | "sample">("oauth");
  const [clientId, setClientId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("librun_strava_client_id") || "";
    }
    return "";
  });
  const [clientSecret, setClientSecret] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("librun_strava_client_secret") || "";
    }
    return "";
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentDomain = typeof window !== "undefined" ? window.location.hostname : "localhost";

  const handleCopyDomain = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  const [syncLimit, setSyncLimit] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("librun_sync_limit");
      if (saved !== null) return Number(saved);
    }
    return 0; // 0 = Todas as corridas por padrão
  });

  if (!isOpen) return null;

  // Handle direct file upload (CSV / ZIP / GPX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setUploadStatus("Enviando e processando atividades...");
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/activities/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Falha ao importar arquivo");
      }
      setUploadStatus(data.message);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Erro desconhecido ao carregar arquivo");
      setUploadStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle OAuth Strava Redirect
  const handleStartOAuth = async () => {
    if (!clientId.trim()) {
      setErrorMsg("Por favor, preencha o Client ID do seu app Strava.");
      return;
    }
    if (!clientSecret.trim()) {
      setErrorMsg("Por favor, preencha o Client Secret do seu app Strava.");
      return;
    }
    setErrorMsg(null);
    setIsSyncing(true);
    setUploadStatus("Iniciando autorização com o Strava...");

    try {
      // Salvar credenciais exclusivamente no LocalStorage do navegador deste dispositivo
      localStorage.setItem("librun_strava_client_id", clientId.trim());
      localStorage.setItem("librun_strava_client_secret", clientSecret.trim());
      localStorage.setItem("librun_sync_limit", String(syncLimit));

      // Obter URL de autorização do Strava
      const redirectUri = window.location.origin;
      const res = await fetch("/api/strava/auth-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          redirect_uri: redirectUri,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(
          data.detail ||
          data.error ||
          `Erro ao obter URL do Strava (HTTP ${res.status}). Verifique se o backend está conectado.`
        );
      }

      // Redirecionar usuário para o Strava
      window.location.href = data.url;
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Erro ao iniciar autenticação Strava.");
      setUploadStatus(null);
      setIsSyncing(false);
    }
  };

  // Sync recent runs from Strava
  const handleSyncStrava = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setUploadStatus(
      syncLimit === 0
        ? "Conectando ao Strava e baixando todo o seu histórico de corridas..."
        : `Conectando ao Strava e baixando as ${syncLimit} corridas mais recentes...`
    );

    try {
      localStorage.setItem("librun_sync_limit", String(syncLimit));
      const savedCid = typeof window !== "undefined" ? localStorage.getItem("librun_strava_client_id") : null;
      const savedCsec = typeof window !== "undefined" ? localStorage.getItem("librun_strava_client_secret") : null;

      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          count: syncLimit,
          client_id: savedCid || undefined,
          client_secret: savedCsec || undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Falha na sincronização.");
      }
      setUploadStatus(`Sincronização concluída! ${data.runs_synced} corridas sincronizadas.`);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
      setUploadStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <UploadCloud className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Conectar Atividades do Strava
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha a forma mais conveniente para importar suas corridas.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("oauth")}
            className={`py-2 px-3 rounded-lg transition ${
              activeTab === "oauth"
                ? "bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-emerald-500/30 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            1. Conexão Strava API (OAuth)
          </button>
          <button
            onClick={() => setActiveTab("file")}
            className={`py-2 px-3 rounded-lg transition ${
              activeTab === "file"
                ? "bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-emerald-500/30 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            2. Importar Arquivo (CSV / ZIP)
          </button>
        </div>

        {/* Tab 1: Strava OAuth */}
        {activeTab === "oauth" && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center justify-between">
                <span>Como obter suas credenciais gratuitas:</span>
                <a
                  href="https://www.strava.com/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center space-x-1 font-semibold"
                >
                  <span>Strava Developers</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
                <li>Acesse <strong>strava.com/settings/api</strong>.</li>
                <li>Crie ou edite sua aplicação Strava (Ex: <em>librun</em>).</li>
                <li className="leading-relaxed">
                  No campo <strong>Authorization Callback Domain</strong>, digite exatamente:
                  <span className="inline-flex items-center gap-1.5 ml-1 my-0.5">
                    <code className="bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-mono font-bold text-xs select-all">
                      {currentDomain}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-[10px] font-semibold transition inline-flex items-center gap-1 text-slate-700 dark:text-slate-200"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </span>
                </li>
                <li>Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> e cole nos campos abaixo:</li>
              </ol>

              {currentDomain !== "localhost" && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    <strong>Atenção:</strong> Como este app está rodando em <code>{currentDomain}</code>, o Strava exige que o campo <em>Authorization Callback Domain</em> seja <strong>{currentDomain}</strong> (sem <code>https://</code> e sem barras).
                  </span>
                </div>
              )}
            </div>

            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-300 leading-tight">
              🔒 <strong>Privacidade Total (Armazenamento Local):</strong> O Client ID e o Client Secret são gravados apenas no seu navegador local (LocalStorage). Eles nunca são salvos publicamente no banco do servidor nem compartilhados entre aparelhos.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Client ID do Strava
                </label>
                <input
                  type="text"
                  placeholder="Ex: 123456"
                  value={clientId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClientId(val);
                    if (typeof window !== "undefined") {
                      if (val.trim()) localStorage.setItem("librun_strava_client_id", val.trim());
                      else localStorage.removeItem("librun_strava_client_id");
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Client Secret do Strava
                </label>
                <input
                  type="password"
                  placeholder="Ex: a1b2c3d4e5f6... (Salvo apenas neste aparelho)"
                  value={clientSecret}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClientSecret(val);
                    if (typeof window !== "undefined") {
                      if (val.trim()) localStorage.setItem("librun_strava_client_secret", val.trim());
                      else localStorage.removeItem("librun_strava_client_secret");
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
                />
              </div>

              {/* Quantidade de Corridas para Sincronizar */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">
                    Quantas corridas sincronizar?
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {syncLimit === 0 ? "Todas as corridas (sem limite)" : `${syncLimit} corridas`}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 text-center">
                  {[0, 50, 100, 200, 500, 1000].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSyncLimit(num)}
                      className={`py-1.5 rounded-xl text-xs font-semibold border transition ${
                        syncLimit === num
                          ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm font-bold"
                          : "bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {num === 0 ? "Todas" : num}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {syncLimit === 0 ? "Importa todo o histórico disponível no Strava sem limite." : `Importa até ${syncLimit} atividades de corrida mais recentes.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={handleStartOAuth}
                disabled={isSyncing}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#FC5200] hover:bg-[#e04800] text-white flex items-center justify-center space-x-2 transition shadow-lg shadow-orange-500/20"
              >
                <span>Autorizar com o Strava</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {athlete?.has_strava_token && (
                <button
                  onClick={handleSyncStrava}
                  disabled={isSyncing}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center justify-center space-x-2 transition shadow-md"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Sincronizar Agora</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: File Upload */}
        {activeTab === "file" && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="font-bold text-slate-900 dark:text-slate-200">
                Como baixar seu histórico completo no Strava:
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                No site do Strava, vá em <strong>Configurações &gt; Minha Conta &gt; Baixar ou Excluir sua Conta</strong> e clique em <em>Solicitar seu Arquivo</em>. Você receberá um e-mail com o link para download do ZIP. Você pode subir o arquivo <strong>export.zip</strong> diretamente aqui ou o arquivo <strong>activities.csv</strong>.
              </p>
            </div>

            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/60 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-950/70 transition group">
              <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition mb-2" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                Clique para selecionar seu activities.csv ou export.zip
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
                Suporta também arquivos GPX individuais
              </span>
              <input
                type="file"
                accept=".csv,.zip,.gpx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isSyncing}
              />
            </label>
          </div>
        )}

        {/* Status Messages */}
        {uploadStatus && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{uploadStatus}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-800 dark:text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
