import time
from typing import Dict, Any, List, Optional
import httpx
from database import get_athlete_settings, save_athlete_settings, upsert_activity

STRAVA_AUTH_BASE = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"

def get_strava_auth_url(client_id: str, redirect_uri: str) -> str:
    scope = "read,activity:read_all"
    return (
        f"{STRAVA_AUTH_BASE}?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"approval_prompt=auto&"
        f"scope={scope}"
    )

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
        "strava_client_secret": client_secret,
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

async def get_valid_access_token() -> Optional[str]:
    """Ensures token is not expired, refreshing if necessary."""
    settings = get_athlete_settings()
    access_token = settings.get("strava_access_token")
    refresh_token = settings.get("strava_refresh_token")
    expires_at = settings.get("strava_token_expires_at") or 0
    client_id = settings.get("strava_client_id")
    client_secret = settings.get("strava_client_secret")

    if not access_token or not refresh_token:
        return None

    # Refresh if expiring within 5 minutes
    if time.time() >= (expires_at - 300):
        if not client_id or not client_secret:
            return None
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(STRAVA_TOKEN_URL, data=payload, timeout=20.0)
            if res.status_code != 200:
                return None
            data = res.json()

        access_token = data.get("access_token")
        save_athlete_settings({
            "strava_access_token": access_token,
            "strava_refresh_token": data.get("refresh_token"),
            "strava_token_expires_at": data.get("expires_at")
        })

    return access_token

async def sync_strava_activities(count: int = 50, per_page: int = 50) -> Dict[str, Any]:
    """Syncs activities directly from Strava API v3 up to the requested run count."""
    token = await get_valid_access_token()
    if not token:
        raise ValueError("Strava não está conectado ou credenciais expiraram. Conecte sua conta primeiro.")

    headers = {"Authorization": f"Bearer {token}"}
    synced_count = 0
    runs_count = 0
    target_count = max(1, count)
    page_size = min(max(5, target_count), 100)
    page = 1

    async with httpx.AsyncClient() as client:
        while runs_count < target_count:
            url = f"{STRAVA_API_BASE}/athlete/activities?page={page}&per_page={page_size}"
            res = await client.get(url, headers=headers, timeout=25.0)
            if res.status_code != 200:
                break
            activities = res.json()
            if not activities or not isinstance(activities, list):
                break

            for act in activities:
                act_type = act.get("type") or act.get("sport_type") or "Run"
                is_run = "run" in act_type.lower() or act_type in ["Run", "TrailRun", "VirtualRun"]

                # We save all activities or prioritize runs
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
                    if runs_count >= target_count:
                        break

            if len(activities) < page_size:
                break
            page += 1
            if page > 10:  # safety limit
                break

    return {
        "success": True,
        "total_synced": synced_count,
        "runs_synced": runs_count,
        "requested_count": target_count
    }
