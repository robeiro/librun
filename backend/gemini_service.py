import os
import json
import logging
from typing import Dict, Any, Optional, List
import httpx

from database import (
    get_athlete_settings, 
    save_ai_analysis, 
    get_latest_ai_analysis
)

logger = logging.getLogger("librun.gemini")

DEFAULT_MODEL = "gemini-flash-lite-latest"
KNOWN_POPULAR_MODELS = [
    {"id": "gemini-flash-lite-latest", "displayName": "Gemini Flash-Lite Latest (Mais Rápido & Alta Disponibilidade - Recomendado)", "description": "Menor latência, alta cota e excelente estabilidade."},
    {"id": "gemini-3.5-flash", "displayName": "Gemini 3.5 Flash", "description": "Modelo avançado equilibrado."},
    {"id": "gemini-3.8-flash", "displayName": "Gemini 3.8 Flash", "description": "Versão 3.8 Flash mais recente."},
    {"id": "gemini-flash-latest", "displayName": "Gemini Flash Latest", "description": "Aponta para versão Flash mais recente."},
    {"id": "gemini-3.5-flash-lite", "displayName": "Gemini 3.5 Flash Lite", "description": "Versão 3.5 Flash leve."},
    {"id": "gemini-3-flash-preview", "displayName": "Gemini 3 Flash Preview", "description": "Preview da geração 3."},
    {"id": "gemini-2.5-pro", "displayName": "Gemini 2.5 Pro (Raciocínio Profundo)", "description": "Maior capacidade analítica."},
    {"id": "gemini-2.0-flash", "displayName": "Gemini 2.0 Flash", "description": "Versão 2.0 Flash."},
    {"id": "gemini-1.5-flash", "displayName": "Gemini 1.5 Flash (Legado)", "description": "Versão 1.5 Flash legada."},
]

def get_gemini_key(override_key: Optional[str] = None) -> Optional[str]:
    """Retrieve Gemini API key from explicit client override or environment variable."""
    if override_key and override_key.strip():
        return override_key.strip()
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    return None

def get_gemini_model() -> str:
    """Retrieve configured Gemini model from athlete settings."""
    settings = get_athlete_settings()
    model = settings.get("gemini_model")
    if model and model.strip():
        return model.strip().replace("models/", "")
    return DEFAULT_MODEL

async def list_available_models(api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """Queries Google Generative Language ModelService.ListModels to see all models available for this API key."""
    key = api_key or get_gemini_key()
    if not key:
        return KNOWN_POPULAR_MODELS

    endpoints = [
        f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
        f"https://generativelanguage.googleapis.com/v1/models?key={key}",
    ]

    for ep in endpoints:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(ep)
                if res.status_code == 200:
                    data = res.json()
                    models_raw = data.get("models", [])
                    available = []
                    for m in models_raw:
                        methods = m.get("supportedGenerationMethods", [])
                        if "generateContent" in methods:
                            clean_id = m.get("name", "").replace("models/", "")
                            available.append({
                                "id": clean_id,
                                "name": m.get("name"),
                                "displayName": m.get("displayName") or clean_id,
                                "description": m.get("description", "")
                            })
                    if available:
                        return available
        except Exception as e:
            logger.warning(f"Erro ao listar modelos em {ep}: {e}")

    return KNOWN_POPULAR_MODELS

async def validate_gemini_key(api_key: str, chosen_model: Optional[str] = None) -> Dict[str, Any]:
    """Validates if the provided Gemini API key is valid and fetches its supported models."""
    if not api_key or not api_key.strip():
        return {"valid": False, "error": "Chave API não fornecida."}

    key = api_key.strip()

    # 1. Fetch available models from Google ModelService
    available_models = await list_available_models(key)
    
    # 2. Select model to test
    target_model = chosen_model.replace("models/", "").strip() if chosen_model else get_gemini_model()
    if not any(m["id"] == target_model for m in available_models) and available_models:
        # If target model is not in available models, pick the first working model from Google
        target_model = available_models[0]["id"]

    # 3. Test generateContent with target model
    endpoints = [
        f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={key}",
        f"https://generativelanguage.googleapis.com/v1/models/{target_model}:generateContent?key={key}",
    ]

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "Ping de teste. Responda apenas com a palavra OK."}
                ]
            }
        ],
        "generationConfig": {
            "maxOutputTokens": 10,
            "temperature": 0.1
        }
    }

    last_error = ""
    for ep in endpoints:
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.post(ep, json=payload)
                if response.status_code == 200:
                    return {
                        "valid": True,
                        "message": f"Chave API conectada com sucesso ao Google Gemini (Modelo: {target_model})!",
                        "tested_model": target_model,
                        "available_models": available_models
                    }
                else:
                    try:
                        err_json = response.json()
                        err_msg = err_json.get("error", {}).get("message", response.text)
                    except Exception:
                        err_msg = response.text
                    last_error = f"Erro do Google ({response.status_code}): {err_msg}"
        except httpx.TimeoutException:
            last_error = "Tempo limite esgotado ao conectar ao Google Gemini."
        except Exception as e:
            last_error = f"Falha de conexão: {str(e)}"

    return {
        "valid": False,
        "error": last_error,
        "available_models": available_models
    }

async def call_gemini(
    prompt: str, 
    api_key: Optional[str] = None, 
    model: Optional[str] = None
) -> str:
    """Calls Gemini API with the given prompt and configured model."""
    key = api_key or get_gemini_key()
    if not key:
        raise ValueError("Chave da API Gemini não configurada. Adicione sua chave nas configurações.")

    chosen_model = (model or get_gemini_model()).replace("models/", "").strip()
    
    # Try the user's selected model first, then safe fallbacks
    models_to_try = [chosen_model]
    for m in ["gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"]:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error = None

    for candidate_model in models_to_try:
        # Try both v1beta and v1 endpoints
        endpoints = [
            f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:generateContent?key={key}",
            f"https://generativelanguage.googleapis.com/v1/models/{candidate_model}:generateContent?key={key}",
        ]

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 3000,
            }
        }

        for ep in endpoints:
            try:
                async with httpx.AsyncClient(timeout=40.0) as client:
                    res = await client.post(ep, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"]
                        raise ValueError("Formato de resposta inesperado retornado pelo Gemini.")
                    elif res.status_code in [400, 403]:
                        # Authentication or quota error
                        try:
                            err_msg = res.json().get("error", {}).get("message", res.text)
                        except Exception:
                            err_msg = res.text
                        raise ValueError(f"Erro na chave da API Gemini: {err_msg}")
                    else:
                        # 404 (model not found) or 503 (temporarily unavailable) -> try next
                        try:
                            err_msg = res.json().get("error", {}).get("message", res.text)
                        except Exception:
                            err_msg = res.text
                        last_error = f"Modelo '{candidate_model}' indisponível ({res.status_code}): {err_msg}"
            except httpx.TimeoutException:
                last_error = f"Tempo de resposta excedido com o modelo {candidate_model}."
            except ValueError:
                raise
            except Exception as e:
                last_error = str(e)

    raise RuntimeError(
        f"Não foi possível obter resposta do Gemini com o modelo configurado ({chosen_model}).\n"
        f"Detalhe: {last_error}\n"
        f"Dica: Acesse as Configurações ⚙️ e selecione outro modelo do Gemini (ex.: gemini-2.0-flash ou gemini-pro)."
    )

def format_pace(speed_ms: float) -> str:
    if not speed_ms or speed_ms <= 0:
        return "--:--"
    sec_km = 1000 / speed_ms
    m = int(sec_km // 60)
    s = int(sec_km % 60)
    return f"{m}:{s:02d} /km"

def format_time_sec(seconds: int) -> str:
    m = seconds // 60
    s = seconds % 60
    h = m // 60
    rem_m = m % 60
    if h > 0:
        return f"{h}h {rem_m:02d}m {s:02d}s"
    return f"{rem_m}m {s:02d}s"

async def generate_global_coaching_analysis(
    activities: List[Dict[str, Any]],
    settings: Dict[str, Any],
    analytics: Dict[str, Any],
    force_refresh: bool = False,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Generates an in-depth AI coaching diagnosis of the athlete's overall fitness, 80/20 balance, ACWR, and next 14 days action plan."""
    if not force_refresh:
        cached = get_latest_ai_analysis("coach_global")
        if cached:
            return {
                "success": True,
                "analysis": cached["content"],
                "created_at": cached["created_at"],
                "cached": True,
                "model_used": cached.get("model_used") or get_gemini_model()
            }

    key = get_gemini_key(api_key)
    if not key:
        return {
            "success": False,
            "error": "Chave da API Gemini não configurada. Acesse Configurações para adicionar sua chave."
        }

    # Extract summary metrics
    summary = analytics.get("summary", {})
    acwr = analytics.get("acwr", {})
    hr_dist = analytics.get("hr_distribution", {})
    race_preds = analytics.get("race_predictions", {}).get("predictions", {})

    athlete_name = settings.get("athlete_name", "Corredor")
    max_hr = settings.get("max_hr", 190)
    rest_hr = settings.get("rest_hr", 55)
    target_dist = settings.get("target_distance", "10k")
    target_time = settings.get("target_time_minutes", 50.0)

    total_runs = summary.get("total_runs", len(activities))
    total_km = summary.get("total_distance_km", 0)
    avg_pace = summary.get("avg_pace_formatted", "--:--")
    avg_hr = summary.get("avg_hr", "--")
    avg_cadence = summary.get("avg_cadence", "--")

    # Recent activities overview (last 10 runs)
    recent_acts = activities[:10]
    recent_runs_text = []
    for a in recent_acts:
        date_str = str(a.get("start_date", ""))[:10]
        dist_km = round(a.get("distance", 0) / 1000, 2)
        moving_s = a.get("moving_time", 0)
        dur = format_time_sec(moving_s)
        spd = a.get("distance", 0) / moving_s if moving_s > 0 else 0
        pace = format_pace(spd)
        hr = round(a.get("average_heartrate")) if a.get("average_heartrate") else "--"
        cad = round(a.get("average_cadence")) if a.get("average_cadence") else "--"
        recent_runs_text.append(f"- {date_str}: {a.get('name', 'Corrida')} | {dist_km} km em {dur} (Pace: {pace}, FC: {hr} bpm, Cad: {cad} spm)")

    recent_runs_summary = "\n".join(recent_runs_text) if recent_runs_text else "Sem histórico recente detalhado."

    prompt = f"""Você é um treinador de corrida de elite mundial e fisiologista do exercício (nível olímpico e especialista na metodologia 80/20 do Dr. Stephen Seiler e no índice de controle de carga ACWR do Dr. Tim Gabbett).

Você está analisando os dados reais e o histórico do atleta {athlete_name}.

=== DADOS DO ATLETA ===
- Nome: {athlete_name}
- FC Máxima: {max_hr} bpm | FC Repouso: {rest_hr} bpm
- Distância Foco / Meta: {target_dist} em {target_time} minutos
- Total de Corridas Registradas: {total_runs}
- Volume Total Acumulado: {total_km} km
- Ritmo Médio Geral: {avg_pace}
- FC Média Geral: {avg_hr} bpm
- Cadência Média: {avg_cadence} spm

=== STATUS DE CARGA & RISCO DE LESÃO (ACWR) ===
- Carga Aguda (últimos 7 dias): {acwr.get('acute_km', 0)} km ({acwr.get('acute_runs', 0)} treinos)
- Carga Crônica (média últimas 4 semanas): {acwr.get('chronic_km', 0)} km/sem
- Razão ACWR: {acwr.get('ratio', 1.0)}
- Nível de Risco Avaliado: {acwr.get('status', 'normal')}
- Diagnóstico de Carga: {acwr.get('message', '')}

=== DISTRIBUIÇÃO DAS ZONAS CARDÍACAS (80/20 POLARIZADO) ===
- Zona 1 (Recuperação <68%): {hr_dist.get('z1_percent', 0)}%
- Zona 2 (Aeróbica Leve 69-83%): {hr_dist.get('z2_percent', 0)}%
- Zona 3 (Moderada/Zona Cinzenta 84-89%): {hr_dist.get('z3_percent', 0)}%
- Zona 4 (Limiar de Lactato 90-94%): {hr_dist.get('z4_percent', 0)}%
- Zona 5 (Anaeróbica Máxima >95%): {hr_dist.get('z5_percent', 0)}%
- Classificação do Treino: {hr_dist.get('classification', 'Equilibrado')}
- Diagnóstico Polarizado: {hr_dist.get('message', '')}

=== PREVISÕES ATUAIS DE PROVA ===
- 5k: {race_preds.get('5k', {}).get('predicted_time_formatted', '--')} (Pace: {race_preds.get('5k', {}).get('predicted_pace', '--')})
- 10k: {race_preds.get('10k', {}).get('predicted_time_formatted', '--')} (Pace: {race_preds.get('10k', {}).get('predicted_pace', '--')})
- 21k: {race_preds.get('21k', {}).get('predicted_time_formatted', '--')} (Pace: {race_preds.get('21k', {}).get('predicted_pace', '--')})

=== ÚLTIMOS TREINOS DO ATLETA ===
{recent_runs_summary}

=== SUA TAREFA ===
Elabore uma análise completa, altamente técnica, encorajadora e estruturada em Markdown de alto nível com os seguintes tópicos bem definidos:

1. 🏅 **Diagnóstico Geral do Nível e Perfil do Atleta**:
   Avalie a base aeróbica, consistência e viabilidade da meta ({target_dist} em {target_time} min).

2. ⚡ **Pontos Fortes Confirmados nos Dados**:
   O que o atleta já faz muito bem que deve continuar fazendo.

3. ⚠️ **Gargalos Críticos & Onde Está Perdendo Rendimento**:
   Analise com precisão cirúrgica a distribuição de zonas cardíacas (se há excesso de Zona Cinzenta Z3), a cadência de passada (risco de overstriding) e o índice de fadiga ACWR.

4. 📋 **Prescrição Tática para as Próximas 2 Semanas**:
   Sugira uma estrutura semanal equilibrada com tipos de treino exatos:
   - Treino Regenerativo (duração, zona de FC e pace alvo)
   - Treino de Rodagem Z2 (o pilar da densidade mitocondrial)
   - Treino Específico / Intervalado (tiros ou limiar com ritmos recomendados)
   - Longão do final de semana

5. 💡 **A 'Dica de Ouro' do Treinador**:
   Uma única instrução prática e memorável que trará o maior salto de rendimento sem se machucar.

Escreva em português brasileiro de forma direta, motivadora, usando termos técnicos do atletismo de forma clara e visualmente agradável com emojis pontuais e formatação rica em Markdown.
"""

    current_model = get_gemini_model()
    analysis_text = await call_gemini(prompt, model=current_model)
    save_ai_analysis(analysis_type="coach_global", content=analysis_text, model_used=current_model)

    return {
        "success": True,
        "analysis": analysis_text,
        "cached": False,
        "created_at": "Agora",
        "model_used": current_model
    }

async def generate_single_activity_analysis(
    activity: Dict[str, Any],
    settings: Dict[str, Any],
    force_refresh: bool = False,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Generates an AI deep dive / debrief for a specific running session."""
    strava_id = str(activity.get("strava_id") or activity.get("id"))
    if not force_refresh:
        cached = get_latest_ai_analysis("activity", target_id=strava_id)
        if cached:
            return {
                "success": True,
                "analysis": cached["content"],
                "created_at": cached["created_at"],
                "cached": True,
                "model_used": cached.get("model_used") or get_gemini_model()
            }

    key = get_gemini_key(api_key)
    if not key:
        return {
            "success": False,
            "error": "Chave da API Gemini não configurada. Configure sua chave para analisar esta corrida."
        }

    athlete_name = settings.get("athlete_name", "Corredor")
    max_hr = settings.get("max_hr", 190)

    dist_m = activity.get("distance", 0)
    dist_km = round(dist_m / 1000, 2)
    moving_time_s = activity.get("moving_time", 0)
    dur_str = format_time_sec(moving_time_s)
    speed = dist_m / moving_time_s if moving_time_s > 0 else 0
    pace = format_pace(speed)
    avg_hr = activity.get("average_heartrate")
    max_hr_act = activity.get("max_heartrate")
    cadence = activity.get("average_cadence")
    elev = activity.get("total_elevation_gain", 0)
    suffer = activity.get("suffer_score")
    date_str = str(activity.get("start_date", ""))[:10]
    name = activity.get("name", "Corrida")

    hr_intensity_pct = round((avg_hr / max_hr) * 100, 1) if avg_hr and max_hr else None

    prompt = f"""Você é um treinador de corrida de alta performance e fisiologista esportivo. Faça um debriefing detalhado desta corrida específica do atleta {athlete_name}:

=== TELEMETRIA DA ATIVIDADE ===
- Nome do Treino: {name}
- Data: {date_str}
- Distância: {dist_km} km
- Tempo em Movimento: {dur_str}
- Ritmo Médio (Pace): {pace}
- Ganho de Elevação: {elev} m
- Frequência Cardíaca Média: {f'{round(avg_hr)} bpm ({hr_intensity_pct}% da FC Máxima {max_hr} bpm)' if avg_hr else 'Não registrada'}
- Frequência Cardíaca Máxima no Treino: {f'{round(max_hr_act)} bpm' if max_hr_act else '--'}
- Cadência Média: {f'{round(cadence)} spm' if cadence else 'Não registrada'}
- Score de Esforço / Carga Relativa: {suffer or '--'}

=== SUA ANÁLISE ===
Responda em Markdown estruturado, cobrindo:
1. 🎯 **Classificação do Treino Realizado**: Qual foi o propósito fisiológico evidente desta sessão (ex: Rodagem Regenerativa, Treino Contínuo Z2, Tempo Run / Fartlek, Longão ou Corrida em Ritmo de Prova)?
2. 🫀 **Eficiência Cardíaca & Biomecânica**: O coração e a cadência trabalharam em harmonia para a velocidade atingida?
3. 🔋 **Tempo de Recuperação Estimado**: Quantas horas de descanso até o próximo treino de intensidade e cuidados de hidratação/sono recomendados.
4. 👟 **Próximo Treino Recomendado**: O que o atleta deve calçar os tênis para fazer no treino seguinte para otimizar a supercompensação.

Escreva de forma elegante, precisa, em português brasileiro e com tópicos objetivos.
"""

    current_model = get_gemini_model()
    analysis_text = await call_gemini(prompt, model=current_model)
    save_ai_analysis(analysis_type="activity", content=analysis_text, target_id=strava_id, model_used=current_model)

    return {
        "success": True,
        "analysis": analysis_text,
        "cached": False,
        "created_at": "Agora",
        "model_used": current_model
    }
