#!/usr/bin/env python3
"""
Vercel Deployment Manager
=========================
Day 12–14 of the Vercel Intensive.

Features
--------
1. List recent deployments with status, URL, and age
2. Purge the CDN cache for a specific path
3. Roll back to the previous successful deployment
4. Alert via webhook (Discord/Slack) when a deployment fails

Why this matters for a Senior Support Engineering interview
-----------------------------------------------------------
"I don't just consume Vercel's platform — I extend it. This script automates
 the operational tasks that every support engineer needs to do during an
 incident: check deployments, isolate the bad build, purge stale cache, and
 roll back — all from the CLI, without clicking through a dashboard."

Usage
-----
    # List last 5 deployments
    python3 scripts/vercel_manager.py --status

    # Purge cache for /suggested-restaurants/italian
    python3 scripts/vercel_manager.py --purge /suggested-restaurants/italian

    # Roll back to previous production deployment
    python3 scripts/vercel_manager.py --rollback

    # Run all checks (CI/CD health probe)
    python3 scripts/vercel_manager.py --health

Required environment variables
-------------------------------
    VERCEL_TOKEN      — from https://vercel.com/account/tokens
    VERCEL_PROJECT_ID — from Project Settings → General
    VERCEL_TEAM_ID    — optional, for team projects
    WEBHOOK_URL       — optional Discord/Slack webhook for alerts
"""

import argparse
import json
import logging
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ── Logging ───────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("vercel_manager")

# ── SQLite audit log ───────────────────────────────────────────────────────
# Tracks every action this script performs so you can review the audit trail
# ("what was purged and when") — demonstrates the "operational rigor" angle.

DB_PATH = Path(__file__).parent / "vercel_manager_audit.db"


def _init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS audit (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            ts         TEXT    NOT NULL,
            action     TEXT    NOT NULL,
            detail     TEXT,
            result     TEXT,
            duration_ms INTEGER
        )
        """
    )
    conn.commit()
    return conn


def _audit(conn: sqlite3.Connection, action: str, detail: str, result: str, duration_ms: int):
    conn.execute(
        "INSERT INTO audit (ts, action, detail, result, duration_ms) VALUES (?,?,?,?,?)",
        (datetime.now(timezone.utc).isoformat(), action, detail, result, duration_ms),
    )
    conn.commit()


# ── Vercel API client ──────────────────────────────────────────────────────

class VercelAPIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class VercelClient:
    """
    Thin wrapper around the Vercel REST API.

    Implements exponential back-off retry for transient errors:
      429 → rate-limited, wait and retry
      5xx → server-side error, retry up to MAX_RETRIES times
      401 → bad token, fail immediately (no point retrying)
    """

    BASE = "https://api.vercel.com"
    MAX_RETRIES = 3  # maximum retry attempts for transient failures
    RETRY_DELAY = 2  # initial delay in seconds (doubles each attempt)

    def __init__(self, token: str, project_id: str, team_id: Optional[str] = None):
        self.token = token
        self.project_id = project_id
        self.team_id = team_id

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _team_qs(self) -> str:
        return f"&teamId={self.team_id}" if self.team_id else ""

    def request(self, method: str, path: str, body: Optional[dict] = None) -> dict:
        """
        Make an authenticated Vercel API request with retry logic.

        Error handling matrix:
          401/403  → AUTH_ERROR      — bad token, don't retry
          404      → NOT_FOUND       — resource missing, don't retry
          429      → RATE_LIMIT      — wait, then retry
          5xx      → SERVER_ERROR    — retry with back-off
          Network  → NETWORK_ERROR   — retry with back-off
        """
        url = f"{self.BASE}{path}"
        data = json.dumps(body).encode() if body else None

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                req = Request(url, data=data, headers=self._headers(), method=method)
                with urlopen(req, timeout=15) as resp:
                    raw = resp.read()
                    return json.loads(raw) if raw else {}

            except HTTPError as exc:
                error_body = exc.read().decode(errors="replace")
                try:
                    msg = json.loads(error_body).get("error", {}).get("message", error_body)
                except Exception:
                    msg = error_body[:200]

                if exc.code in (401, 403):
                    raise VercelAPIError(exc.code, f"Authentication error: {msg}") from exc

                if exc.code == 404:
                    raise VercelAPIError(exc.code, f"Not found: {msg}") from exc

                if exc.code == 429:
                    retry_after = int(exc.headers.get("Retry-After", self.RETRY_DELAY * attempt))
                    log.warning("Rate limited (429). Waiting %ds before retry %d/%d…",
                                retry_after, attempt, self.MAX_RETRIES)
                    time.sleep(retry_after)
                    continue

                if attempt < self.MAX_RETRIES:
                    wait = self.RETRY_DELAY * (2 ** (attempt - 1))
                    log.warning("HTTP %d on attempt %d/%d. Retrying in %ds…",
                                exc.code, attempt, self.MAX_RETRIES, wait)
                    time.sleep(wait)
                    continue

                raise VercelAPIError(exc.code, f"HTTP {exc.code}: {msg}") from exc

            except URLError as exc:
                if attempt < self.MAX_RETRIES:
                    wait = self.RETRY_DELAY * (2 ** (attempt - 1))
                    log.warning("Network error on attempt %d/%d: %s. Retrying in %ds…",
                                attempt, self.MAX_RETRIES, exc.reason, wait)
                    time.sleep(wait)
                    continue
                raise VercelAPIError(0, f"Network error: {exc.reason}") from exc

        raise VercelAPIError(0, "Max retries exceeded")

    # ── Deployment operations ─────────────────────────────────────────────

    def list_deployments(self, limit: int = 5) -> list[dict]:
        """Return the N most recent deployments for this project."""
        path = (
            f"/v13/deployments?projectId={self.project_id}"
            f"&limit={limit}{self._team_qs()}"
        )
        return self.request("GET", path).get("deployments", [])

    def cancel_deployment(self, deployment_id: str) -> dict:
        """Cancel an in-progress deployment."""
        path = (
            f"/v13/deployments/{deployment_id}/cancel"
            f"?{self._team_qs().lstrip('&')}"
        )
        return self.request("PATCH", path)

    def promote_deployment(self, deployment_id: str) -> dict:
        """Promote a deployment to production (effectively a rollback)."""
        path = (
            f"/v13/deployments/{deployment_id}/promote"
            f"?projectId={self.project_id}{self._team_qs()}"
        )
        return self.request("PATCH", path)

    def purge_cache(self, paths: list[str]) -> dict:
        """Purge CDN cache for a list of URL paths."""
        return self.request(
            "POST",
            f"/v1/projects/{self.project_id}/cache/purge{self._team_qs().replace('&', '?', 1)}",
            body={"paths": paths},
        )


# ── CLI operations ─────────────────────────────────────────────────────────

def cmd_status(client: VercelClient, conn: sqlite3.Connection, limit: int = 5):
    """List recent deployments."""
    t0 = time.monotonic()
    log.info("Fetching last %d deployments…", limit)

    deployments = client.list_deployments(limit)
    duration = int((time.monotonic() - t0) * 1000)

    if not deployments:
        print("No deployments found.")
        _audit(conn, "STATUS", f"limit={limit}", "no deployments", duration)
        return

    header = f"{'#':<4} {'STATE':<13} {'AGE':>8}  {'URL'}"
    print(header)
    print("-" * len(header))

    for i, d in enumerate(deployments, 1):
        state = d.get("state", "UNKNOWN")
        created_ms = d.get("createdAt", 0)
        age = _age(created_ms)
        url = d.get("url", "—")
        print(f"{i:<4} {state:<13} {age:>8}  https://{url}")

    _audit(conn, "STATUS", f"limit={limit}", f"{len(deployments)} deployments", duration)


def cmd_purge(client: VercelClient, conn: sqlite3.Connection, path: str):
    """Purge CDN cache for the given path."""
    t0 = time.monotonic()
    log.info("Purging cache for: %s", path)

    result = client.purge_cache([path])
    duration = int((time.monotonic() - t0) * 1000)

    print(f"Cache purged for {path} in {duration}ms")
    log.info("Purge result: %s", result)
    _audit(conn, "PURGE", path, json.dumps(result)[:200], duration)


def cmd_rollback(client: VercelClient, conn: sqlite3.Connection):
    """Promote the most recent READY deployment that isn't currently live."""
    t0 = time.monotonic()
    log.info("Fetching deployments to determine rollback target…")

    deployments = client.list_deployments(limit=10)
    ready = [d for d in deployments if d.get("state") == "READY"]

    if len(ready) < 2:
        print("Not enough READY deployments to roll back.")
        return

    # The first READY deployment is current; the second is the rollback target
    current = ready[0]
    target = ready[1]

    print(f"Current: {current['url']}  (created {_age(current['createdAt'])} ago)")
    print(f"Target:  {target['url']}  (created {_age(target['createdAt'])} ago)")
    confirm = input("Roll back to target? [y/N] ").strip().lower()

    if confirm != "y":
        print("Rollback cancelled.")
        _audit(conn, "ROLLBACK", target["id"], "cancelled", 0)
        return

    result = client.promote_deployment(target["id"])
    duration = int((time.monotonic() - t0) * 1000)
    print(f"Rollback initiated in {duration}ms — {result}")
    _audit(conn, "ROLLBACK", target["id"], json.dumps(result)[:200], duration)


def cmd_health(client: VercelClient, conn: sqlite3.Connection):
    """Quick health check — reports if the latest deployment is READY."""
    t0 = time.monotonic()
    deployments = client.list_deployments(limit=1)
    duration = int((time.monotonic() - t0) * 1000)

    if not deployments:
        print("UNKNOWN — no deployments found")
        return

    d = deployments[0]
    state = d.get("state", "UNKNOWN")
    url = d.get("url", "—")
    age = _age(d.get("createdAt", 0))

    status = "OK" if state == "READY" else "DEGRADED"
    print(f"[{status}] Latest deployment: {state} — https://{url} ({age} ago)")

    if state not in ("READY", "BUILDING") and os.getenv("WEBHOOK_URL"):
        _send_alert(
            f":warning: Deployment health check failed!\nState: {state}\nURL: https://{url}"
        )

    _audit(conn, "HEALTH", url, state, duration)


# ── Alerting ───────────────────────────────────────────────────────────────

def _send_alert(message: str):
    """Send an alert to Discord or Slack via webhook."""
    url = os.getenv("WEBHOOK_URL")
    if not url:
        return

    # Works for both Discord and Slack webhooks
    payload = json.dumps({"content": message, "text": message}).encode()
    try:
        req = Request(url, data=payload, headers={"Content-Type": "application/json"})
        urlopen(req, timeout=5)
        log.info("Alert sent via webhook.")
    except Exception as exc:  # noqa: BLE001
        log.warning("Failed to send webhook alert: %s", exc)


# ── Utilities ──────────────────────────────────────────────────────────────

def _age(created_ms: int) -> str:
    """Human-readable age from a Unix timestamp in milliseconds."""
    if not created_ms:
        return "unknown"
    delta = time.time() - created_ms / 1000
    if delta < 60:
        return f"{int(delta)}s"
    if delta < 3600:
        return f"{int(delta // 60)}m"
    if delta < 86400:
        return f"{int(delta // 3600)}h"
    return f"{int(delta // 86400)}d"


def _load_env() -> tuple[str, str, Optional[str]]:
    """Load required environment variables, fail fast with clear message."""
    token = os.getenv("VERCEL_TOKEN")
    project_id = os.getenv("VERCEL_PROJECT_ID")
    team_id = os.getenv("VERCEL_TEAM_ID")

    missing = [v for v, val in [("VERCEL_TOKEN", token), ("VERCEL_PROJECT_ID", project_id)] if not val]
    if missing:
        log.error("Missing required environment variables: %s", ", ".join(missing))
        log.error("Set them in your shell or a .env file before running this script.")
        sys.exit(1)

    return token, project_id, team_id  # type: ignore[return-value]


# ── Entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Vercel deployment manager — Vercel Intensive Day 12-14",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--status", action="store_true", help="List recent deployments")
    parser.add_argument("--purge", metavar="PATH", help="Purge CDN cache for PATH")
    parser.add_argument("--rollback", action="store_true", help="Roll back to previous READY deployment")
    parser.add_argument("--health", action="store_true", help="Check if latest deployment is healthy")
    parser.add_argument("--limit", type=int, default=5, help="Number of deployments to show (default: 5)")
    args = parser.parse_args()

    if not any([args.status, args.purge, args.rollback, args.health]):
        parser.print_help()
        sys.exit(0)

    token, project_id, team_id = _load_env()
    client = VercelClient(token, project_id, team_id)
    conn = _init_db()

    try:
        if args.status:
            cmd_status(client, conn, args.limit)
        if args.purge:
            cmd_purge(client, conn, args.purge)
        if args.rollback:
            cmd_rollback(client, conn)
        if args.health:
            cmd_health(client, conn)
    except VercelAPIError as exc:
        log.error("[HTTP %d] %s", exc.status, exc)
        _send_alert(f":rotating_light: Vercel Manager error (HTTP {exc.status}): {exc}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(0)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
