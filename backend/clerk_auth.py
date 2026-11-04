"""Clerk auth verification and middleware for FastAPI."""

import base64
import logging
import os
import ssl
from functools import lru_cache

import certifi
import jwt
import requests
from fastapi import APIRouter, HTTPException, Request, Response
from requests.adapters import HTTPAdapter
from starlette.concurrency import run_in_threadpool
from urllib3.util.retry import Retry

logger = logging.getLogger("clerk_auth")

CLERK_FRONTEND_API = "https://frontend-api.clerk.dev"
CLERK_BACKEND_API = "https://api.clerk.com/v1"
PROXY_PATH = "/api/__clerk"

_HOP_HEADERS = {
    "host", "connection", "keep-alive", "content-length", "transfer-encoding",
    "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate",
    "content-encoding",
}

clerk_router = APIRouter(prefix="/api")
_http = requests.Session()
_retry = Retry(total=2, connect=2, read=2, status=0, backoff_factor=0.1,
               allowed_methods=frozenset({"GET", "HEAD", "OPTIONS"}))
_http.mount("https://", HTTPAdapter(pool_maxsize=40, max_retries=_retry))


def _publishable_key() -> str:
    return os.environ.get("CLERK_PUBLISHABLE_KEY", "").strip()


def _secret_key() -> str:
    return os.environ.get("CLERK_SECRET_KEY", "").strip()


def _is_production() -> bool:
    return _publishable_key().startswith("pk_live_")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


@clerk_router.get("/clerk/config")
def clerk_config():
    key = _publishable_key()
    return {
        "enabled": bool(key and _secret_key()),
        "publishable_key": key,
        "proxy_url": PROXY_PATH if _is_production() else "",
    }


@clerk_router.api_route("/__clerk/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def clerk_proxy(path: str, request: Request):
    if not _is_production():
        raise HTTPException(status_code=404)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    headers = {k: v for k, v in request.headers.items() if k.lower() not in _HOP_HEADERS}
    headers["Clerk-Proxy-Url"] = f"https://{host.split(',')[0].strip()}{PROXY_PATH}"
    headers["Clerk-Secret-Key"] = _secret_key()
    headers["X-Forwarded-For"] = _client_ip(request)
    headers["Accept-Encoding"] = "gzip"

    try:
        upstream = await run_in_threadpool(
            _http.request,
            request.method,
            f"{CLERK_FRONTEND_API}/{path}",
            params=list(request.query_params.multi_items()),
            headers=headers,
            data=await request.body(),
            allow_redirects=False,
            timeout=30,
        )
    except requests.RequestException:
        return Response(status_code=502)
    response = Response(content=upstream.content, status_code=upstream.status_code)
    raw = upstream.raw.headers
    for name in {n.lower() for n in raw.keys()} - _HOP_HEADERS:
        for value in raw.getlist(name):
            response.raw_headers.append((name.encode(), value.encode()))
    return response


def _get_jwks_url() -> str:
    pub = _publishable_key()
    if pub.startswith("pk_test_") or pub.startswith("pk_live_"):
        try:
            parts = pub.split("_")
            if len(parts) >= 3:
                raw = parts[2]
                raw += "=" * (-len(raw) % 4)
                domain = base64.b64decode(raw).decode("utf-8").rstrip("$")
                if domain:
                    return f"https://{domain}/.well-known/jwks.json"
        except Exception as e:
            logger.warning("Could not derive domain from publishable key: %s", e)
    return f"{CLERK_BACKEND_API}/jwks"


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str, secret_key: str) -> jwt.PyJWKClient:
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    headers = {"User-Agent": "nexus-clerk-auth"}
    if secret_key and "api.clerk.com" in jwks_url:
        headers["Authorization"] = f"Bearer {secret_key}"
    return jwt.PyJWKClient(
        jwks_url,
        headers=headers,
        lifespan=3600,
        timeout=10,
        ssl_context=ssl_context,
    )


def verify_session_token(token: str) -> dict:
    """Return the verified claims of a Clerk session token, or raise 401."""
    secret = _secret_key()
    url = _get_jwks_url()
    try:
        jwk_client = _jwks_client(url, secret)
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            key=signing_key.key,
            algorithms=["RS256"],
            leeway=60,
            options={"verify_aud": False},
        )
    except Exception as exc:
        logger.warning("Primary JWKS verification failed via %s: %s (%s). Trying fallback...", url, type(exc).__name__, exc)
        fallback_url = f"{CLERK_BACKEND_API}/jwks" if "clerk.accounts.dev" in url else url
        if fallback_url != url:
            try:
                jwk_client = _jwks_client(fallback_url, secret)
                signing_key = jwk_client.get_signing_key_from_jwt(token)
                return jwt.decode(
                    token,
                    key=signing_key.key,
                    algorithms=["RS256"],
                    leeway=60,
                    options={"verify_aud": False},
                )
            except Exception as e2:
                logger.error("Fallback JWKS verification also failed: %s (%s)", type(e2).__name__, e2)
        logger.error("Token verification failed permanently: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired session")


def require_user(request: Request) -> dict:
    """FastAPI dependency: the signed-in user from `Authorization: Bearer`
    (frontend getToken()) or Clerk's `__session` cookie; user["user_id"] is stable."""
    if not _secret_key() and not _publishable_key():
        raise HTTPException(status_code=503, detail="Clerk is not configured")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.cookies.get("__session", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    claims = verify_session_token(token)
    return {"user_id": claims["sub"], "session_id": claims.get("sid"), "claims": claims}
