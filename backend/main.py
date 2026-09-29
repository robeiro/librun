import os
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Header
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
    get_gemini_model,
    validate_gemini_key,
    list_available_models,
    generate_global_coaching_analysis,
    generate_single_activity_analysis,
)

app = FastAPI(
    title="librun API",
    description="Motor de análise estatística de corrida e treinamento integrado ao Strava e Google Gemini IA",
    version="1.0.1"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def normalize_path_middleware(request, call_next):
    path = request.scope.get("path", "")
    while "//" in path:
        path = path.replace("//", "/")
    while path.startswith("/api/api/"):
        path = path[4:]
    request.scope["path"] = path
    return await call_next(request)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "librun API",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
def health_root():
    return {"status": "ok", "service": "librun"}

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
    gemini_model: Optional[str] = None

@app.get("/api/settings")
def get_settings(
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    settings = get_athlete_settings(athlete_id=x_athlete_id)
    masked = dict(settings)

    # SECURITY & PRIVACY POLICY:
    # Sensitive client credentials, tokens and keys are NEVER returned to clients from the server database.
    # They are strictly local to each client device (LocalStorage).
    masked["strava_client_id"] = None
    masked["strava_client_secret"] = None
    masked["strava_client_secret_configured"] = False
    masked["strava_access_token"] = None
    masked["strava_refresh_token"] = None
    masked["strava_token_expires_at"] = None
    masked["gemini_api_key"] = None
    masked["gemini_api_key_masked"] = None
    masked["gemini_api_key_configured"] = bool(os.environ.get("GEMINI_API_KEY"))
    masked["gemini_model"] = settings.get("gemini_model") or "gemini-1.5-flash"
    masked["has_strava_token"] = False
    return masked

@app.post("/api/settings")
def update_settings(
    payload: AthleteSettingsUpdate,
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    # Only update athlete physical goals and profile settings. Never save personal API keys or tokens to server database.
    data = {
        k: v for k, v in payload.dict().items() 
        if v is not None and k not in [
            "gemini_api_key", "strava_client_secret", "strava_client_id", 
            "strava_access_token", "strava_refresh_token", "strava_token_expires_at"
        ]
    }
    save_athlete_settings(data)
    return {"success": True, "settings": get_settings(x_athlete_id=x_athlete_id)}

@app.get("/api/activities")
def list_activities(
    limit: Optional[int] = Query(default=None),
    type: Optional[str] = Query(default=None),
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    acts = get_activities(limit=limit, act_type=type, athlete_id=x_athlete_id)
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
def delete_all_activities(
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    clear_all_activities(athlete_id=x_athlete_id)
    return {"success": True, "message": "Todas as atividades foram removidas."}

@app.delete("/api/activities/sample")
def delete_sample_activities_endpoint():
    clear_sample_activities()
    return {"success": True, "message": "Atividades de exemplo foram removidas."}

@app.get("/api/analytics")
def get_analytics(
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    """Returns complete personalized running analytics, ACWR, 80/20 zones, and coach advice."""
    activities = get_activities(limit=None, act_type=None, athlete_id=x_athlete_id)
    settings = get_athlete_settings(athlete_id=x_athlete_id)
    analytics_result = compute_full_analytics(activities, settings)
    return analytics_result

class StravaOAuthUrlRequest(BaseModel):
    client_id: str
    redirect_uri: str

@app.post("/api/strava/auth-url")
def generate_auth_url(payload: StravaOAuthUrlRequest):
    # Generates OAuth URL using client_id directly from the client request without saving to DB
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
            sync_res = await sync_strava_activities(
                count=payload.sync_count if payload.sync_count is not None else 0,
                client_id=payload.client_id,
                client_secret=payload.client_secret,
                access_token=res.get("access_token"),
                refresh_token=res.get("refresh_token"),
                token_expires_at=res.get("expires_at"),
                athlete_id=res.get("athlete_id")
            )
            res["sync"] = sync_res
        except Exception as sync_err:
            res["sync_error"] = str(sync_err)

        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro na autorização do Strava: {str(e)}")

class StravaSyncRequest(BaseModel):
    count: Optional[int] = 0
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[int] = None
    athlete_id: Optional[str] = None

@app.post("/api/strava/sync")
async def sync_activities(
    payload: Optional[StravaSyncRequest] = None,
    count: Optional[int] = Query(default=None),
    x_strava_token: Optional[str] = Header(default=None, alias="X-Strava-Token"),
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    target_count = 0
    cid = None
    csecret = None
    token = x_strava_token
    reftoken = None
    expires_at = None
    ath_id = x_athlete_id

    if payload:
        if payload.count is not None:
            target_count = payload.count
        cid = payload.client_id
        csecret = payload.client_secret
        token = payload.access_token or token
        reftoken = payload.refresh_token
        expires_at = payload.token_expires_at
        ath_id = payload.athlete_id or ath_id
    elif count is not None:
        target_count = count

    try:
        res = await sync_strava_activities(
            count=target_count, 
            client_id=cid, 
            client_secret=csecret,
            access_token=token,
            refresh_token=reftoken,
            token_expires_at=expires_at,
            athlete_id=ath_id
        )
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
    chosen_model: Optional[str] = None

@app.get("/api/gemini/models")
async def get_gemini_models_endpoint(
    api_key: Optional[str] = Query(default=None),
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key")
):
    """Returns the list of Gemini models available for generateContent."""
    key = (api_key or x_gemini_key or "").strip() or get_gemini_key()
    models = await list_available_models(key)
    return {"models": models}

@app.post("/api/gemini/validate")
async def validate_gemini_key_endpoint(
    payload: Optional[GeminiValidateRequest] = None,
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key")
):
    """Tests if a Gemini API key is valid and checks model compatibility."""
    key = None
    model = None
    if payload:
        if payload.api_key and payload.api_key.strip():
            key = payload.api_key.strip()
        if payload.chosen_model and payload.chosen_model.strip():
            model = payload.chosen_model.strip()
    if not key and x_gemini_key and x_gemini_key.strip():
        key = x_gemini_key.strip()
    if not key:
        key = get_gemini_key()
    if not key:
        return {"valid": False, "error": "Nenhuma chave Gemini fornecida ou configurada neste dispositivo."}

    result = await validate_gemini_key(key, chosen_model=model)
    return result

@app.get("/api/ai/coach")
async def get_ai_coaching_analysis(
    force_refresh: bool = Query(default=False),
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
    x_gemini_model: Optional[str] = Header(default=None, alias="X-Gemini-Model"),
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    """Returns AI Coach Diagnosis (cached or freshly generated)."""
    key = get_gemini_key(x_gemini_key)
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Chave da API Gemini não configurada neste dispositivo. Acesse Configurações ⚙️ para adicionar sua chave."
        )

    activities = get_activities(limit=None, act_type=None, athlete_id=x_athlete_id)
    if not activities:
        raise HTTPException(
            status_code=400, 
            detail="Nenhuma atividade cadastrada. Sincronize com o Strava ou carregue a base de exemplo."
        )

    settings = get_athlete_settings(athlete_id=x_athlete_id)
    analytics_result = compute_full_analytics(activities, settings)

    res = await generate_global_coaching_analysis(
        activities=activities,
        settings=settings,
        analytics=analytics_result,
        force_refresh=force_refresh,
        api_key=key,
        model=x_gemini_model,
        athlete_id=x_athlete_id
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao gerar diagnóstico IA."))
    return res

@app.post("/api/ai/coach/refresh")
async def refresh_ai_coaching_analysis(
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
    x_gemini_model: Optional[str] = Header(default=None, alias="X-Gemini-Model"),
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    """Forces generation of a brand new AI Coach Diagnosis."""
    key = get_gemini_key(x_gemini_key)
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Chave da API Gemini não configurada neste dispositivo. Acesse Configurações ⚙️ para adicionar sua chave."
        )

    activities = get_activities(limit=None, act_type=None, athlete_id=x_athlete_id)
    if not activities:
        raise HTTPException(
            status_code=400, 
            detail="Nenhuma atividade cadastrada. Sincronize com o Strava ou carregue a base de exemplo."
        )

    settings = get_athlete_settings(athlete_id=x_athlete_id)
    analytics_result = compute_full_analytics(activities, settings)

    res = await generate_global_coaching_analysis(
        activities=activities,
        settings=settings,
        analytics=analytics_result,
        force_refresh=True,
        api_key=key,
        model=x_gemini_model,
        athlete_id=x_athlete_id
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao gerar diagnóstico IA."))
    return res

@app.get("/api/ai/activity/{strava_id}")
async def get_single_activity_ai_analysis(
    strava_id: str, 
    force_refresh: bool = Query(default=False),
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
    x_gemini_model: Optional[str] = Header(default=None, alias="X-Gemini-Model"),
    x_athlete_id: Optional[str] = Header(default=None, alias="X-Athlete-Id")
):
    """Returns AI debrief for a specific running session."""
    key = get_gemini_key(x_gemini_key)
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Chave da API Gemini não configurada neste dispositivo. Configure sua chave nas Configurações ⚙️."
        )

    activities = get_activities(limit=None, act_type=None, athlete_id=x_athlete_id)
    act = next((a for a in activities if str(a.get("strava_id") or a.get("id")) == str(strava_id)), None)
    if not act:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")

    settings = get_athlete_settings(athlete_id=x_athlete_id)
    res = await generate_single_activity_analysis(
        activity=act, 
        settings=settings, 
        force_refresh=force_refresh,
        api_key=key,
        model=x_gemini_model
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao analisar atividade."))
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
