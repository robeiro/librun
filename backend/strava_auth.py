import time
import urllib.parse
from typing import Dict, Any, List, Optional
import httpx
from database import get_athlete_settings, save_athlete_settings, upsert_activity

STRAVA_AUTH_BASE = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"

def get_strava_auth_url(client_id: str, redirect_uri: str) -> str:
    params = {
        "client_id": str(client_id).strip(),
        "redirect_uri": redirect_uri.strip().rstrip("/"),
        "response_type": "code",
        "approval_prompt": "auto",
        "scope": "read,activity:read_all",
    }
    return f"{STRAVA_AUTH_BASE}?{urllib.parse.urlencode(params)}"

async def exchange_strava_code(client_id: Optional[str], client_secret: Optional[str], code: str) -> Dict[str, Any]:
    """Exchanges an authorization code for Strava access & refresh tokens."""
    settings = get_athlete_settings()
    
    if not client_id:
        client_id = settings.get("strava_client_id")
    
    if not client_secret or client_secret.startswith("•"):
        client_secret = settings.get("strava_client_secret")

    if not client_id or not client_secret:
        raise ValueError("Client ID e Client Secret são necessários para autenticar com o Strava.")

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code"
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(STRAVA_TOKEN_URL, data=payload, timeout=20.0)
        res.raise_for_status()
        data = res.json()

    athlete_data = data.get("athlete", {})
    athlete_name = f"{athlete_data.get('firstname', '')} {athlete_data.get('lastname', '')}".strip() or "Corredor Strava"

    save_athlete_settings({
        "strava_client_id": client_id,
        "strava_access_token": data.get("access_token"),
        "strava_refresh_token": data.get("refresh_token"),
        "strava_token_expires_at": data.get("expires_at"),
        "athlete_id": str(athlete_data.get("id", "")),
        "athlete_name": athlete_name
    })

    return {
        "success": True,
        "athlete_name": athlete_name,
        "athlete_id": athlete_data.get("id")
    }

async def get_valid_access_token(client_id: Optional[str] = None, client_secret: Optional[str] = None) -> Optional[str]:
    """Ensures token is not expired, refreshing if necessary."""
    settings = get_athlete_settings()
    access_token = settings.get("strava_access_token")
    refresh_token = settings.get("strava_refresh_token")
    expires_at = settings.get("strava_token_expires_at") or 0

    if not access_token:
        return None

    # If token is still valid for at least 5 minutes, use it directly
    if time.time() < (expires_at - 300):
        return access_token

    # Attempt refresh if client credentials are provided
    cid = client_id or settings.get("strava_client_id")
    csec = client_secret
    if refresh_token and cid and csec:
        payload = {
            "client_id": cid,
            "client_secret": csec,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(STRAVA_TOKEN_URL, data=payload, timeout=20.0)
            if res.status_code == 200:
                data = res.json()
                access_token = data.get("access_token")
                save_athlete_settings({
                    "strava_access_token": access_token,
                    "strava_refresh_token": data.get("refresh_token"),
                    "strava_token_expires_at": data.get("expires_at")
                })
                return access_token

    # If token has not yet completely expired, allow it as fallback
    if time.time() < expires_at:
        return access_token

    return None

async def sync_strava_activities(
    count: int = 0, 
    per_page: int = 200, 
    client_id: Optional[str] = None, 
    client_secret: Optional[str] = None
) -> Dict[str, Any]:
    """
    Syncs activities directly from Strava API v3.
    If count <= 0, fetches ALL activities available on the Strava account.
    If count > 0, fetches until at least `count` running activities are retrieved.
    """
    token = await get_valid_access_token(client_id=client_id, client_secret=client_secret)
    if not token:
        raise ValueError("Strava não está conectado ou a sessão expirou. Conecte sua conta novamente no modal Strava.")

    headers = {"Authorization": f"Bearer {token}"}
    synced_count = 0
    runs_count = 0
    target_all = (count <= 0)
    target_count = 999999 if target_all else count
    
    # Strava API allows up to 200 items per page
    page_size = 200 if target_all else min(max(30, count), 200)
    page = 1
    max_pages = 100  # Allows up to 20,000 activities

    async with httpx.AsyncClient() as client:
        while runs_count < target_count and page <= max_pages:
            url = f"{STRAVA_API_BASE}/athlete/activities?page={page}&per_page={page_size}"
            try:
                res = await client.get(url, headers=headers, timeout=35.0)
            except Exception as req_err:
                print(f"[Strava Sync] Erro de rede na página {page}: {req_err}")
                break

            if res.status_code == 429:
                print("[Strava Sync] Limite de requisições da API do Strava atingido (429).")
                break
            if res.status_code != 200:
                print(f"[Strava Sync] Código de status inesperado {res.status_code}: {res.text[:200]}")
                break

            activities = res.json()
            if not activities or not isinstance(activities, list) or len(activities) == 0:
                # Reached the end of athlete's history
                break

            for act in activities:
                act_type = act.get("sport_type") or act.get("type") or "Run"
                is_run = "run" in act_type.lower() or act_type in ["Run", "TrailRun", "VirtualRun"]

                upsert_activity({
                    "strava_id": str(act.get("id")),
                    "name": act.get("name", "Corrida Strava"),
                    "type": act_type,
                    "distance": float(act.get("distance", 0.0)),
                    "moving_time": int(act.get("moving_time", 0)),
                    "elapsed_time": int(act.get("elapsed_time", act.get("moving_time", 0))),
                    "total_elevation_gain": float(act.get("total_elevation_gain", 0.0) or 0.0),
                    "start_date": act.get("start_date", ""),
                    "start_date_local": act.get("start_date_local", ""),
                    "average_speed": float(act.get("average_speed", 0.0)),
                    "max_speed": float(act.get("max_speed", 0.0)),
                    "average_cadence": act.get("average_cadence"),
                    "average_heartrate": act.get("average_heartrate"),
                    "max_heartrate": act.get("max_heartrate"),
                    "suffer_score": act.get("suffer_score"),
                    "source": "strava_api",
                    "raw_data": act
                })
                synced_count += 1
                if is_run:
                    runs_count += 1
                    if not target_all and runs_count >= target_count:
                        break

            # If Strava returned fewer items than requested, we reached the very last page!
            if len(activities) < page_size:
                break

            page += 1
            # Brief pause to respect Strava rate limiter smoothly
            time.sleep(0.15)

    return {
        "success": True,
        "total_synced": synced_count,
        "runs_synced": runs_count,
        "requested_count": "todas" if target_all else target_count,
        "pages_fetched": page
    }
