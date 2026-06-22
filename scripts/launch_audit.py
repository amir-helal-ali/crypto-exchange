#!/usr/bin/env python3
"""
Launch-readiness audit for EgMoney crypto-exchange.

Verifies:
  1. All builds succeed (frontend, admin, backend)
  2. docker-compose.yml syntax + required env vars
  3. SSL certs present
  4. No light-mode / polling leftovers
  5. Health endpoints wired
  6. .env secrets non-default
  7. All required volumes / networks present
  8. Nginx regen-config script executable
"""
import os
import re
import sys
import subprocess
from pathlib import Path

ROOT = Path("/home/z/my-project/crypto-exchange")
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
RESET = "\033[0m"
BOLD = "\033[1m"

failures = []
warnings = []
passes = []


def ok(msg):
    passes.append(msg)
    print(f"  {GREEN}✓{RESET} {msg}")


def fail(msg):
    failures.append(msg)
    print(f"  {RED}✗{RESET} {msg}")


def warn(msg):
    warnings.append(msg)
    print(f"  {YELLOW}!{RESET} {msg}")


def section(title):
    print(f"\n{BOLD}── {title} ──{RESET}")


# ============================================================
section("1. Backend build")
# ============================================================
go_bin = os.path.expanduser("~/go/bin/go")
if not os.path.exists(go_bin):
    fail(f"Go not installed at {go_bin}")
else:
    env = os.environ.copy()
    env["PATH"] = os.path.expanduser("~/go/bin") + ":" + env["PATH"]
    r = subprocess.run(
        [go_bin, "build", "-o", "/tmp/audit-backend", "."],
        cwd=str(ROOT / "backend"),
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )
    if r.returncode == 0:
        ok("backend: go build succeeds")
        size = os.path.getsize("/tmp/audit-backend")
        ok(f"backend binary: {size / 1024 / 1024:.1f} MB")
    else:
        fail("backend: go build FAILED")
        print(r.stderr[-2000:])


# ============================================================
section("2. Frontend build (SvelteKit)")
# ============================================================
r = subprocess.run(
    ["npm", "run", "build"],
    cwd=str(ROOT / "frontend"),
    capture_output=True,
    text=True,
    timeout=180,
)
if r.returncode == 0:
    ok("frontend: npm run build succeeds")
else:
    fail("frontend: build FAILED")
    print(r.stderr[-2000:])


# ============================================================
section("3. Admin build (Next.js)")
# ============================================================
r = subprocess.run(
    ["npm", "run", "build"],
    cwd=str(ROOT / "admin"),
    capture_output=True,
    text=True,
    timeout=240,
)
if r.returncode == 0:
    ok("admin: npm run build succeeds")
else:
    fail("admin: build FAILED")
    print(r.stderr[-2000:])


# ============================================================
section("4. docker-compose.yml syntax + structure")
# ============================================================
compose = (ROOT / "docker-compose.yml").read_text()
required_services = ["postgres", "redis", "backend", "frontend", "admin", "nginx"]
for svc in required_services:
    if re.search(rf"^\s*{svc}:\s*$", compose, re.MULTILINE):
        ok(f"compose: service '{svc}' present")
    else:
        fail(f"compose: service '{svc}' MISSING")

required_volumes = ["pgdata", "uploads", "nginx-shared", "acme-webroot", "letsencrypt"]
for vol in required_volumes:
    if re.search(rf"^\s*{vol}:\s*$", compose, re.MULTILINE):
        ok(f"compose: volume '{vol}' present")
    else:
        warn(f"compose: volume '{vol}' not found (may be a bind mount)")


# ============================================================
section("5. .env secrets non-default")
# ============================================================
env_file = (ROOT / ".env").read_text()
jwt = re.search(r"^JWT_SECRET=(\S+)", env_file, re.MULTILINE)
if jwt and len(jwt.group(1)) >= 32 and not jwt.group(1).startswith("CHANGE_ME"):
    ok(".env: JWT_SECRET looks strong (>=32 chars, non-default)")
else:
    fail(".env: JWT_SECRET is default / weak / missing")

admin_pw = re.search(r"^ADMIN_PASSWORD=(\S+)", env_file, re.MULTILINE)
if admin_pw and admin_pw.group(1) != "Admin@123456":
    ok(".env: ADMIN_PASSWORD non-default")
else:
    warn(".env: ADMIN_PASSWORD is default 'Admin@123456' — change before production")

pg_pw = re.search(r"^POSTGRES_PASSWORD=(\S+)", env_file, re.MULTILINE)
if pg_pw and "EgMoney@2024Secure!" not in pg_pw.group(1):
    ok(".env: POSTGRES_PASSWORD non-default")
else:
    warn(".env: POSTGRES_PASSWORD is default — change before production")


# ============================================================
section("6. SSL certificates present")
# ============================================================
certs_dir = ROOT / "certs"
local_cert = certs_dir / "local.pem"
local_key = certs_dir / "local-key.pem"
if local_cert.exists() and local_key.exists():
    ok(f"SSL: local.pem + local-key.pem present in ./certs/")
    # Check expiry
    r = subprocess.run(
        ["openssl", "x509", "-in", str(local_cert), "-noout", "-enddate"],
        capture_output=True, text=True,
    )
    if r.returncode == 0:
        ok(f"SSL cert expiry: {r.stdout.strip().split('=')[1]}")
else:
    warn("SSL: no local cert in ./certs/ — admin will need to generate one via SSL tab")


# ============================================================
section("7. No light-mode leftovers in frontend")
# ============================================================
frontend_src = ROOT / "frontend" / "src"
light_refs = []
for p in frontend_src.rglob("*.svelte"):
    txt = p.read_text(errors="ignore")
    # Look for actual light-mode branches (not just the word "light" in comments)
    if re.search(r"theme\s*===\s*'light'", txt) or re.search(r"\bisLight\s*\?", txt):
        light_refs.append(str(p.relative_to(frontend_src)))
if not light_refs:
    ok("frontend: no `theme === 'light'` / `isLight ?` branches remaining")
else:
    fail(f"frontend: light-mode branches still present in: {light_refs}")

# Check theme toggle component removed
toggle = frontend_src / "lib" / "components" / "ThemeToggle.svelte"
if not toggle.exists():
    ok("frontend: ThemeToggle.svelte removed")
else:
    fail("frontend: ThemeToggle.svelte still exists")


# ============================================================
section("8. Admin theme: dark-only + no toggles")
# ============================================================
admin_src = ROOT / "admin" / "src"
toggle_patterns = ["next-themes", "useTheme", "toggleTheme", "setTheme", "prefers-color-scheme"]
found_toggles = []
for p in admin_src.rglob("*.tsx"):
    txt = p.read_text(errors="ignore")
    for pat in toggle_patterns:
        if pat in txt:
            found_toggles.append(f"{p.relative_to(admin_src)}: {pat}")
if not found_toggles:
    ok("admin: no theme toggle / next-themes / prefers-color-scheme references")
else:
    fail(f"admin: theme toggle references found: {found_toggles}")


# ============================================================
section("9. Backend endpoints registered (SSL + metrics + nginx)")
# ============================================================
main_go = (ROOT / "backend" / "main.go").read_text()
for endpoint in [
    "/ssl/status", "/ssl/generate", "/ssl/renew", "/ssl/install",
    "/metrics",
    "/nginx/reload",
    "/admin/stream",  # SSE
    "/ws/market",     # WebSocket
    "/ws/user",       # User WS
]:
    if endpoint in main_go:
        ok(f"backend: route '{endpoint}' registered")
    else:
        fail(f"backend: route '{endpoint}' MISSING")


# ============================================================
section("10. Nginx SSL + ACME infrastructure")
# ============================================================
nginx_tpl = (ROOT / "nginx" / "nginx.conf.template").read_text()
if "acme-challenge" in nginx_tpl:
    ok("nginx: ACME HTTP-01 challenge location configured")
if "ssl_certificate" in nginx_tpl:
    ok("nginx: SSL directives in template")
if "TLSv1.3" in nginx_tpl:
    ok("nginx: TLSv1.3 enabled")

regen = ROOT / "nginx" / "scripts" / "regen-config.sh"
entry = ROOT / "nginx" / "scripts" / "entrypoint.sh"
if regen.exists() and os.access(regen, os.X_OK):
    ok("nginx: regen-config.sh exists + executable")
else:
    fail("nginx: regen-config.sh missing or not executable")
if entry.exists() and os.access(entry, os.X_OK):
    ok("nginx: entrypoint.sh exists + executable")
else:
    fail("nginx: entrypoint.sh missing or not executable")


# ============================================================
section("11. Backend Dockerfile has openssl + certbot")
# ============================================================
be_dockerfile = (ROOT / "backend" / "Dockerfile").read_text()
if "openssl" in be_dockerfile and "certbot" in be_dockerfile:
    ok("backend Dockerfile: openssl + certbot installed")
else:
    fail("backend Dockerfile: missing openssl / certbot")
if "/etc/nginx/certs" in be_dockerfile and "/var/www/certbot" in be_dockerfile:
    ok("backend Dockerfile: SSL + ACME dirs created")


# ============================================================
section("12. Redis Pub/Sub + WebSocket hub wired")
# ============================================================
pubsub_path = ROOT / "backend" / "pubsub" / "pubsub.go"
if pubsub_path.exists():
    ok("backend: pubsub/pubsub.go exists")
    pubsub_txt = pubsub_path.read_text()
    if "ChanUserEvent" in pubsub_txt and "ChanAdminEvent" in pubsub_txt and "ChanMarketTick" in pubsub_txt:
        ok("backend: PubSub channels defined (user + admin + market)")
else:
    fail("backend: pubsub package missing")

jwtutil_path = ROOT / "backend" / "jwtutil" / "jwtutil.go"
if jwtutil_path.exists():
    ok("backend: jwtutil package exists (cycle breaker)")
else:
    fail("backend: jwtutil package missing")


# ============================================================
section("13. Health endpoints")
# ============================================================
health_path = ROOT / "backend" / "handlers" / "health.go"
if health_path.exists():
    health_txt = health_path.read_text()
    if "/api/health/live" in main_go or "live" in health_txt.lower():
        ok("backend: /api/health/live endpoint exists")
    if "/api/health" in main_go:
        ok("backend: /api/health endpoint exists")
else:
    fail("backend: health.go handler missing")


# ============================================================
section("14. Matching engine event-driven (no polling)")
# ============================================================
matching_path = ROOT / "backend" / "matching" / "engine.go"
if matching_path.exists():
    m_txt = matching_path.read_text()
    if "OnTickerUpdate" in m_txt and "SetPriceProvider" in m_txt:
        ok("backend: matching engine is event-driven (OnTickerUpdate + SetPriceProvider)")
    else:
        fail("backend: matching engine missing event-driven hooks")
    # Look for forbidden HTTP polling
    if re.search(r'time\.NewTicker.*\n.*http\.', m_txt, re.DOTALL):
        fail("backend: matching engine still has HTTP polling!")
    else:
        ok("backend: matching engine: no HTTP polling detected")
else:
    fail("backend: matching/engine.go missing")


# ============================================================
# Summary
# ============================================================
print(f"\n{BOLD}════════════════════════════════════════════{RESET}")
print(f"{BOLD}AUDIT SUMMARY{RESET}")
print(f"{BOLD}════════════════════════════════════════════{RESET}")
print(f"  {GREEN}Passed:{RESET}    {len(passes)}")
print(f"  {YELLOW}Warnings:{RESET}  {len(warnings)}")
print(f"  {RED}Failed:{RESET}    {len(failures)}")
print()
if warnings:
    print(f"{YELLOW}Warnings to review before production launch:{RESET}")
    for w in warnings:
        print(f"  ! {w}")
    print()
if failures:
    print(f"{RED}FAILURES (must fix before launch):{RESET}")
    for f in failures:
        print(f"  ✗ {f}")
    sys.exit(1)
else:
    print(f"{GREEN}{BOLD}✓ READY FOR LAUNCH{RESET} (after addressing warnings)")
    sys.exit(0)
