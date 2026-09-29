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
    athlete_id = str(athlete_data.get("id", ""))

    # Update only athlete_name in settings without saving sensitive tokens
    save_athlete_settings({
        "athlete_name": athlete_name,
    })

    return {
        "success": True,
        "athlete_name": athlete_name,
        "athlete_id": athlete_id,
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_at": data.get("expires_at"),
    }

async def get_valid_access_token(
    client_id: Optional[str] = None, 
    client_secret: Optional[str] = None,
    access_token: Optional[str] = None,
    refresh_token: Optional[str] = None,
    token_expires_at: Optional[int] = None
) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
    """Ensures token is not expired, refreshing with Strava if necessary."""
    expires_at = token_expires_at or 0

    # 1. If access_token is provided and still valid for at least 5 minutes, use it directly
    if access_token and (expires_at == 0 or time.time() < (expires_at - 300)):
        return access_token, None

    # 2. Attempt refresh if refresh_token and client credentials are provided
    if refresh_token and client_id and client_secret:
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(STRAVA_TOKEN_URL, data=payload, timeout=20.0)
                if res.status_code == 200:
                    data = res.json()
                    new_token = data.get("access_token")
                    new_tokens = {
                        "access_token": new_token,
                        "refresh_token": data.get("refresh_token") or refresh_token,
                        "expires_at": data.get("expires_at"),
                    }
                    return new_token, new_tokens
        except Exception:
            pass

    # 3. If access_token has not yet completely expired, allow it as fallback
    if access_token and (expires_at == 0 or time.time() < expires_at):
        return access_token, None

    return None, None

async def sync_strava_activities(
    count: int = 0, 
    per_page: int = 200, 
    client_id: Optional[str] = None, 
    client_secret: Optional[str] = None,
    access_token: Optional[str] = None,
    refresh_token: Optional[str] = None,
    token_expires_at: Optional[int] = None,
    athlete_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Syncs activities directly from Strava API v3.
    Tokens are provided strictly by the requesting client (LocalStorage).
    """
    token, new_tokens = await get_valid_access_token(
        client_id=client_id,
        client_secret=client_secret,
        access_token=access_token,
        refresh_token=refresh_token,
        token_expires_at=token_expires_at
    )
    if not token:
        raise ValueError("Sessão do Strava não encontrada ou expirada. Conecte sua conta no modal do Strava.")

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
                }, athlete_id=athlete_id)
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
        "pages_fetched": page,
        "new_tokens": new_tokens
    }
