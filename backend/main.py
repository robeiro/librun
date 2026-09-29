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

app = FastAPI(
    title="librun API",
    description="Motor de análise estatística de corrida e treinamento integrado ao Strava",
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

@app.get("/api/settings")
def get_settings():
    settings = get_athlete_settings()
    # Mask sensitive Strava secret
    masked = dict(settings)
    if masked.get("strava_client_secret"):
        masked["strava_client_secret_configured"] = True
        masked["strava_client_secret"] = "••••••••"
    else:
        masked["strava_client_secret_configured"] = False
    masked["has_strava_token"] = bool(masked.get("strava_access_token"))
    return masked

@app.post("/api/settings")
def update_settings(payload: AthleteSettingsUpdate):
    data = {k: v for k, v in payload.dict().items() if v is not None}
    save_athlete_settings(data)
    return {"success": True, "settings": get_athlete_settings()}

@app.get("/api/activities")
def list_activities(
    limit: int = Query(default=100, ge=1, le=500),
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
    activities = get_activities(limit=500, act_type=None)
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
    sync_count: Optional[int] = 50

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

        # Automatically trigger sync with requested count
        try:
            sync_res = await sync_strava_activities(count=payload.sync_count or 50)
            res["sync"] = sync_res
        except Exception as sync_err:
            res["sync_error"] = str(sync_err)

        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro na autorização do Strava: {str(e)}")

class StravaSyncRequest(BaseModel):
    count: Optional[int] = 50

@app.post("/api/strava/sync")
async def sync_activities(
    payload: Optional[StravaSyncRequest] = None,
    count: Optional[int] = Query(default=None)
):
    target_count = 50
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
