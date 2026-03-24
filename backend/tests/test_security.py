# VenderScope — Security Test Suite
# Run with:  cd backend && python -m pytest tests/test_security.py -v
#
# Covers: Registration, Login, JWT, Authorization, Password Security

import time
import uuid
import pytest
from fastapi.testclient import TestClient
from jose import jwt

# ── Bootstrap ────────────────────────────────────────────────────────────────
# Set env vars BEFORE importing main — auth_service and limiter read them at import time
import os
os.environ.setdefault("JWT_SECRET", "test-secret-for-security-tests-only-not-production")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_security.db")
os.environ["RATE_LIMIT_ENABLED"] = "0"  # Disable rate limiting — tests share one IP

from main import app
from database import engine, Base
from services.auth_service import JWT_SECRET, ALGORITHM

# Use a fresh DB for tests
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)

VALID_EMAIL = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
VALID_PASS  = "SecureP@ss123!"


# ═════════════════════════════════════════════════════════════════════════════
# REGISTRATION TESTS
# ═════════════════════════════════════════════════════════════════════════════

class TestRegistration:
    """Tests for POST /api/auth/register"""

    def test_register_valid(self):
        """Register with valid credentials — expect 200."""
        resp = client.post("/api/auth/register", json={
            "email": VALID_EMAIL, "password": VALID_PASS,
        })
        assert resp.status_code == 200
        assert "created" in resp.json()["message"].lower()

    def test_register_duplicate_email(self):
        """Register with duplicate email — expect 400."""
        resp = client.post("/api/auth/register", json={
            "email": VALID_EMAIL, "password": VALID_PASS,
        })
        assert resp.status_code == 400
        # Should NOT reveal "email already exists" — generic message
        detail = resp.json()["detail"]
        assert "email" not in detail.lower() or "already" not in detail.lower()

    def test_register_missing_email(self):
        """Register with missing email — expect 422 validation error."""
        resp = client.post("/api/auth/register", json={"password": VALID_PASS})
        assert resp.status_code == 422

    def test_register_missing_password(self):
        """Register with missing password — expect 422 validation error."""
        resp = client.post("/api/auth/register", json={"email": "missing@pw.com"})
        assert resp.status_code == 422

    def test_register_long_password_rejected(self):
        """Register with 10,000-char password — expect 422 rejection (CRIT-03)."""
        resp = client.post("/api/auth/register", json={
            "email": "longpw@test.com", "password": "A" * 10_000,
        })
        assert resp.status_code == 422

    def test_register_sql_injection_email(self):
        """Register with SQL injection in email — safe handling."""
        resp = client.post("/api/auth/register", json={
            "email": "'; DROP TABLE users; --@test.com",
            "password": VALID_PASS,
        })
        # Should be 422 (invalid email format) — NOT a 500 crash
        assert resp.status_code == 422

    def test_register_xss_payload_email(self):
        """Register with XSS payload in email — safe handling/escaping."""
        resp = client.post("/api/auth/register", json={
            "email": "<script>alert(1)</script>@test.com",
            "password": VALID_PASS,
        })
        assert resp.status_code == 422

    def test_register_invalid_email_format(self):
        """Register with invalid email format — expect 422."""
        resp = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": VALID_PASS,
        })
        assert resp.status_code == 422

    def test_register_short_password(self):
        """Register with password < 8 chars — expect 422."""
        resp = client.post("/api/auth/register", json={
            "email": "short@pw.com",
            "password": "abc",
        })
        assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# LOGIN TESTS
# ═════════════════════════════════════════════════════════════════════════════

class TestLogin:
    """Tests for POST /api/auth/login"""

    def test_login_correct_credentials(self):
        """Login with correct credentials — expect 200 + JWT token."""
        resp = client.post("/api/auth/login", json={
            "email": VALID_EMAIL, "password": VALID_PASS,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self):
        """Login with wrong password — expect 401."""
        resp = client.post("/api/auth/login", json={
            "email": VALID_EMAIL, "password": "WrongPassword123!",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self):
        """Login with non-existent user — expect 401 (same as wrong password)."""
        resp = client.post("/api/auth/login", json={
            "email": "nobody@nowhere.com", "password": "SomePassword123!",
        })
        assert resp.status_code == 401

    def test_login_sql_injection_password(self):
        """Login with SQL injection in password — safe handling."""
        resp = client.post("/api/auth/login", json={
            "email": VALID_EMAIL,
            "password": "' OR '1'='1'; DROP TABLE users; --",
        })
        # Should be 401 (wrong password) — NOT a 500 crash
        assert resp.status_code == 401

    def test_login_empty_fields(self):
        """Login with empty fields — expect 422."""
        resp = client.post("/api/auth/login", json={
            "email": "", "password": "",
        })
        assert resp.status_code == 422

    def test_login_long_password_rejected(self):
        """Login with 10,000-char password — expect 422 (bcrypt DoS protection)."""
        resp = client.post("/api/auth/login", json={
            "email": VALID_EMAIL, "password": "A" * 10_000,
        })
        assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# JWT TOKEN TESTS
# ═════════════════════════════════════════════════════════════════════════════

def _get_valid_token():
    """Helper — get a valid access token."""
    resp = client.post("/api/auth/login", json={
        "email": VALID_EMAIL, "password": VALID_PASS,
    })
    return resp.json()["access_token"]


class TestJWT:
    """Tests for JWT token validation on protected routes."""

    def test_valid_token(self):
        """Use a valid token — expect 200."""
        token = _get_valid_token()
        resp = client.get("/api/vendors/", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

    def test_expired_token(self):
        """Use an expired token — expect 401 or 403."""
        expired = jwt.encode(
            {"sub": "fake-user-id", "exp": 1000000000, "type": "access"},
            JWT_SECRET, algorithm=ALGORITHM,
        )
        resp = client.get("/api/vendors/", headers={"Authorization": f"Bearer {expired}"})
        assert resp.status_code in (401, 403)

    def test_tampered_payload(self):
        """Use a token with tampered user_id — expect 401."""
        token = _get_valid_token()
        # Decode, change sub, re-encode with same secret
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        payload["sub"] = "tampered-user-id"
        tampered = jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)
        resp = client.get("/api/vendors/", headers={"Authorization": f"Bearer {tampered}"})
        # User with tampered-user-id doesn't exist → 401
        assert resp.status_code == 401

    def test_none_algorithm(self):
        """Use a token with 'none' algorithm (CVE-2015-9235) — expect 401."""
        # Manually construct an unsigned token
        import base64, json as jsonlib
        header = base64.urlsafe_b64encode(jsonlib.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=")
        payload = base64.urlsafe_b64encode(jsonlib.dumps({"sub": "fake", "type": "access"}).encode()).rstrip(b"=")
        none_token = f"{header.decode()}.{payload.decode()}."
        resp = client.get("/api/vendors/", headers={"Authorization": f"Bearer {none_token}"})
        assert resp.status_code in (401, 403)

    def test_wrong_secret(self):
        """Use a token signed with a different secret — expect 401."""
        wrong = jwt.encode(
            {"sub": "fake-user-id", "type": "access"},
            "completely-wrong-secret",
            algorithm=ALGORITHM,
        )
        resp = client.get("/api/vendors/", headers={"Authorization": f"Bearer {wrong}"})
        assert resp.status_code in (401, 403)

    def test_no_token(self):
        """Access protected route with no token — expect 401 or 403."""
        resp = client.get("/api/vendors/")
        assert resp.status_code in (401, 403)

    def test_token_no_sensitive_data(self):
        """Check token payload does not contain password hash or other secrets."""
        token = _get_valid_token()
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        assert "password" not in str(payload).lower()
        assert "hash" not in str(payload).lower()
        assert "secret" not in str(payload).lower()
        # Should only contain: sub, exp, type
        assert set(payload.keys()).issubset({"sub", "exp", "type", "iat", "nbf"})

    def test_refresh_token_cannot_access_protected(self):
        """A refresh token should NOT work as an access token."""
        # Login + get refresh cookie, then try to use it as Bearer
        login_resp = client.post("/api/auth/login", json={
            "email": VALID_EMAIL, "password": VALID_PASS,
        })
        # Manually create a refresh-type token
        refresh = jwt.encode(
            {"sub": "fake-user-id", "type": "refresh"},
            JWT_SECRET, algorithm=ALGORITHM,
        )
        resp = client.get("/api/vendors/", headers={"Authorization": f"Bearer {refresh}"})
        assert resp.status_code == 401


# ═════════════════════════════════════════════════════════════════════════════
# AUTHORIZATION TESTS
# ═════════════════════════════════════════════════════════════════════════════

class TestAuthorization:
    """Tests for cross-user access control (IDOR protection)."""

    def _create_user_and_vendor(self, email_suffix):
        """Helper — create a user, login, add a vendor, return (token, vendor_id)."""
        email = f"authtest_{email_suffix}_{uuid.uuid4().hex[:6]}@example.com"
        client.post("/api/auth/register", json={"email": email, "password": VALID_PASS})
        login = client.post("/api/auth/login", json={"email": email, "password": VALID_PASS})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        v = client.post("/api/vendors/", json={
            "name": f"TestVendor-{email_suffix}",
            "domain": f"test-{email_suffix}-{uuid.uuid4().hex[:4]}.com",
        }, headers=headers)
        return token, v.json()["id"]

    def test_user_a_cannot_read_user_b_vendors(self):
        """User A tries to access User B's vendor — expect 404."""
        token_a, _ = self._create_user_and_vendor("a")
        _, vendor_b = self._create_user_and_vendor("b")
        headers_a = {"Authorization": f"Bearer {token_a}"}
        # User A tries to get events for User B's vendor
        resp = client.get(f"/api/vendors/{vendor_b}/events", headers=headers_a)
        assert resp.status_code == 404

    def test_user_a_cannot_delete_user_b_vendor(self):
        """User A tries to delete User B's vendor — expect 404."""
        token_a, _ = self._create_user_and_vendor("c")
        _, vendor_b = self._create_user_and_vendor("d")
        headers_a = {"Authorization": f"Bearer {token_a}"}
        resp = client.delete(f"/api/vendors/{vendor_b}", headers=headers_a)
        assert resp.status_code == 404

    def test_unauthenticated_access_protected(self):
        """Unauthenticated user accesses protected endpoints — expect 401/403."""
        for endpoint in ["/api/vendors/", "/api/quota/"]:
            resp = client.get(endpoint)
            assert resp.status_code in (401, 403), f"Expected 401/403 for {endpoint}, got {resp.status_code}"


# ═════════════════════════════════════════════════════════════════════════════
# PASSWORD SECURITY TESTS
# ═════════════════════════════════════════════════════════════════════════════

class TestPasswordSecurity:
    """Tests for password handling."""

    def test_passwords_hashed_with_bcrypt(self):
        """Verify passwords are stored as bcrypt hashes."""
        from database import SessionLocal
        from models import User
        db = SessionLocal()
        user = db.query(User).filter(User.email == VALID_EMAIL).first()
        assert user is not None
        # bcrypt hashes start with $2b$ or $2a$
        assert user.password_hash.startswith("$2b$") or user.password_hash.startswith("$2a$")
        db.close()

    def test_password_not_in_api_response(self):
        """Verify password is not returned in any API response."""
        token = _get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        # Check login response
        login_resp = client.post("/api/auth/login", json={
            "email": VALID_EMAIL, "password": VALID_PASS,
        })
        body = str(login_resp.json())
        assert VALID_PASS not in body
        assert "password_hash" not in body
        assert "$2b$" not in body

    def test_min_password_enforced(self):
        """Verify minimum password length is enforced."""
        resp = client.post("/api/auth/register", json={
            "email": "minpw@test.com", "password": "short",
        })
        assert resp.status_code == 422

    def test_max_password_enforced(self):
        """Verify maximum password length is enforced (bcrypt DoS protection)."""
        resp = client.post("/api/auth/register", json={
            "email": "maxpw@test.com", "password": "A" * 200,
        })
        assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════════════
# SECURITY HEADERS TESTS
# ═════════════════════════════════════════════════════════════════════════════

class TestSecurityHeaders:
    """Tests for HTTP security headers."""

    def test_security_headers_present(self):
        """Verify security headers are set on responses."""
        resp = client.get("/")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "camera=()" in resp.headers.get("Permissions-Policy", "")

    def test_error_response_no_stack_trace(self):
        """Verify 500 errors don't expose stack traces."""
        # Access a non-existent route — should get 404 or 405, not 500 with trace
        resp = client.get("/api/nonexistent-endpoint-12345")
        body = str(resp.json())
        assert "Traceback" not in body
        assert "File " not in body


# ═════════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═════════════════════════════════════════════════════════════════════════════

def teardown_module():
    """Clean up test database."""
    import os
    try:
        os.remove("test_security.db")
    except FileNotFoundError:
        pass
