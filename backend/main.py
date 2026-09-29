import os
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    init_db,
    get_activities,
    get_athlete_settings,
    save_athlete_settings,
    clear_all_activities,
    clear_sample_activities,
)
from analytics import compute_full_analytics
from importer import parse_strava_csv, parse_strava_zip, parse_gpx_file
from sample_data import seed_sample_activities
from strava_auth import (
    get_strava_auth_url,
    exchange_strava_code,
    sync_strava_activities
)
from gemini_service import (
    get_gemini_key,
    validate_gemini_key,
    generate_global_coaching_analysis,
    generate_single_activity_analysis,
)

app = FastAPI(
    title="librun API",
    description="Motor de análise estatística de corrida e treinamento integrado ao Strava e Google Gemini IA",
    version="1.0.0"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "librun"}

class AthleteSettingsUpdate(BaseModel):
    athlete_name: Optional[str] = None
    max_hr: Optional[int] = None
    rest_hr: Optional[int] = None
    target_distance: Optional[str] = None
    target_time_minutes: Optional[float] = None
    strava_client_id: Optional[str] = None
    strava_client_secret: Optional[str] = None
    gemini_api_key: Optional[str] = None

@app.get("/api/settings")
def get_settings():
    settings = get_athlete_settings()
    masked = dict(settings)
    # Mask Strava secret
    if masked.get("strava_client_secret"):
        masked["strava_client_secret_configured"] = True
        masked["strava_client_secret"] = "••••••••"
    else:
        masked["strava_client_secret_configured"] = False

    # Mask Gemini API key
    if masked.get("gemini_api_key"):
        raw_key = masked["gemini_api_key"].strip()
        masked["gemini_api_key_configured"] = True
        masked["gemini_api_key_masked"] = (raw_key[:6] + "..." + raw_key[-4:]) if len(raw_key) > 10 else "••••••••"
        masked["gemini_api_key"] = "••••••••"
    else:
        env_key = os.environ.get("GEMINI_API_KEY")
        if env_key:
            masked["gemini_api_key_configured"] = True
            masked["gemini_api_key_masked"] = "Variável de Ambiente (GEMINI_API_KEY)"
            masked["gemini_api_key"] = "••••••••"
        else:
            masked["gemini_api_key_configured"] = False
            masked["gemini_api_key_masked"] = None

    masked["has_strava_token"] = bool(masked.get("strava_access_token"))
    return masked

@app.post("/api/settings")
def update_settings(payload: AthleteSettingsUpdate):
    data = {k: v for k, v in payload.dict().items() if v is not None}
    save_athlete_settings(data)
    return {"success": True, "settings": get_settings()}

@app.get("/api/activities")
def list_activities(
    limit: Optional[int] = Query(default=None),
    type: Optional[str] = Query(default=None)
):
    acts = get_activities(limit=limit, act_type=type)
    return {"count": len(acts), "activities": acts}

@app.post("/api/activities/upload")
async def upload_activity_file(file: UploadFile = File(...)):
    """Handles Strava export ZIP, CSV, or GPX files."""
    filename = file.filename.lower()
    content = await file.read()

    try:
        if filename.endswith(".zip"):
            imported, skipped = parse_strava_zip(content)
            return {
                "success": True,
                "message": f"Arquivo ZIP do Strava processado com sucesso! {imported} atividades importadas.",
                "imported": imported,
                "skipped": skipped
            }
        elif filename.endswith(".csv"):
            imported, skipped = parse_strava_csv(content)
            return {
                "success": True,
                "message": f"Arquivo CSV processado com sucesso! {imported} atividades importadas.",
                "imported": imported,
                "skipped": skipped
            }
        elif filename.endswith(".gpx"):
            ok = parse_gpx_file(content, filename=file.filename)
            if not ok:
                raise HTTPException(status_code=400, detail="Não foi possível ler o arquivo GPX.")
            return {
                "success": True,
                "message": f"Atividade GPX '{file.filename}' importada com sucesso!",
                "imported": 1,
                "skipped": 0
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Formato não suportado. Por favor envie um arquivo .csv (export Strava), .zip ou .gpx."
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar arquivo: {str(e)}")

@app.post("/api/activities/sample")
def populate_sample_data():
    """Generates realistic sample running activities for instant analysis."""
    count = seed_sample_activities(clear_existing=True)
    return {
        "success": True,
        "message": f"Base de exemplo carregada com {count} atividades de corrida ao longo de 10 semanas.",
        "count": count
    }

@app.delete("/api/activities")
def delete_all_activities():
    clear_all_activities()
    return {"success": True, "message": "Todas as atividades foram removidas."}

@app.delete("/api/activities/sample")
def delete_sample_activities_endpoint():
    clear_sample_activities()
    return {"success": True, "message": "Atividades de exemplo foram removidas."}

@app.get("/api/analytics")
def get_analytics():
    """Returns complete personalized running analytics, ACWR, 80/20 zones, and coach advice."""
    activities = get_activities(limit=None, act_type=None)
    settings = get_athlete_settings()
    analytics_result = compute_full_analytics(activities, settings)
    return analytics_result

class StravaOAuthUrlRequest(BaseModel):
    client_id: str
    redirect_uri: str

@app.post("/api/strava/auth-url")
def generate_auth_url(payload: StravaOAuthUrlRequest):
    save_athlete_settings({"strava_client_id": payload.client_id})
    url = get_strava_auth_url(payload.client_id, payload.redirect_uri)
    return {"url": url}

class StravaExchangeRequest(BaseModel):
    code: str
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    sync_count: Optional[int] = 0

@app.post("/api/strava/callback")
async def exchange_token(payload: StravaExchangeRequest):
    try:
        res = await exchange_strava_code(
            client_id=payload.client_id,
            client_secret=payload.client_secret,
            code=payload.code
        )
        # Clear sample activities so athlete only sees their real runs
        clear_sample_activities()

        # Automatically trigger sync with requested count (0 = todas)
        try:
            sync_res = await sync_strava_activities(count=payload.sync_count if payload.sync_count is not None else 0)
            res["sync"] = sync_res
        except Exception as sync_err:
            res["sync_error"] = str(sync_err)

        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro na autorização do Strava: {str(e)}")

class StravaSyncRequest(BaseModel):
    count: Optional[int] = 0

@app.post("/api/strava/sync")
async def sync_activities(
    payload: Optional[StravaSyncRequest] = None,
    count: Optional[int] = Query(default=None)
):
    target_count = 0
    if payload and payload.count is not None:
        target_count = payload.count
    elif count is not None:
        target_count = count

    try:
        res = await sync_strava_activities(count=target_count)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao sincronizar com o Strava: {str(e)}")

# ==========================================
# GEMINI AI ENDPOINTS
# ==========================================

class GeminiValidateRequest(BaseModel):
    api_key: Optional[str] = None

@app.post("/api/gemini/validate")
async def validate_gemini_key_endpoint(payload: Optional[GeminiValidateRequest] = None):
    """Tests if a Gemini API key is valid."""
    key = None
    if payload and payload.api_key and payload.api_key.strip():
        key = payload.api_key.strip()
    if not key:
        key = get_gemini_key()
    if not key:
        return {"valid": False, "error": "Nenhuma chave Gemini fornecida ou configurada."}

    result = await validate_gemini_key(key)
    return result

@app.get("/api/ai/coach")
async def get_ai_coaching_analysis(force_refresh: bool = Query(default=False)):
    """Returns AI Coach Diagnosis (cached or freshly generated)."""
    activities = get_activities(limit=None, act_type=None)
    if not activities:
        raise HTTPException(
            status_code=400, 
            detail="Nenhuma atividade cadastrada. Sincronize com o Strava ou carregue a base de exemplo."
        )

    settings = get_athlete_settings()
    analytics_result = compute_full_analytics(activities, settings)

    res = await generate_global_coaching_analysis(
        activities=activities,
        settings=settings,
        analytics=analytics_result,
        force_refresh=force_refresh
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao gerar diagnóstico IA."))
    return res

@app.post("/api/ai/coach/refresh")
async def refresh_ai_coaching_analysis():
    """Forces generation of a brand new AI Coach Diagnosis."""
    activities = get_activities(limit=None, act_type=None)
    if not activities:
        raise HTTPException(
            status_code=400, 
            detail="Nenhuma atividade cadastrada. Sincronize com o Strava ou carregue a base de exemplo."
        )

    settings = get_athlete_settings()
    analytics_result = compute_full_analytics(activities, settings)

    res = await generate_global_coaching_analysis(
        activities=activities,
        settings=settings,
        analytics=analytics_result,
        force_refresh=True
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao gerar diagnóstico IA."))
    return res

@app.get("/api/ai/activity/{strava_id}")
async def get_single_activity_ai_analysis(strava_id: str, force_refresh: bool = Query(default=False)):
    """Returns AI debrief for a specific running session."""
    activities = get_activities(limit=None, act_type=None)
    act = next((a for a in activities if str(a.get("strava_id") or a.get("id")) == str(strava_id)), None)
    if not act:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")

    settings = get_athlete_settings()
    res = await generate_single_activity_analysis(activity=act, settings=settings)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao analisar atividade."))
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
