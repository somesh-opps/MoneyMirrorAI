"""
app.py — MoneyMirror Flask Gateway (port 8000)
Handles: Auth, File Uploads, CSV uploads, Chat history
Proxies financial computation requests to main.py (FastAPI, port 8001)
"""

import smtplib
import random
import string
import time
import os
import json
import re
import atexit
import socket
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests as http_requests
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from bson.objectid import ObjectId
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# APP INIT
# ──────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ──────────────────────────────────────────────
# COMPUTATION ENGINE (main.py / FastAPI)
# ──────────────────────────────────────────────
COMPUTE_BASE = os.getenv("COMPUTE_BASE_URL", "http://127.0.0.1:8001")
COMPUTE_TIMEOUT = int(os.getenv("COMPUTE_TIMEOUT_SEC", "60"))


def _proxy_post(path: str, payload: dict):
    """Forward a JSON POST to the computation engine and return its response."""
    try:
        r = http_requests.post(
            f"{COMPUTE_BASE}{path}",
            json=payload,
            timeout=COMPUTE_TIMEOUT,
        )
        return r.json(), r.status_code
    except http_requests.exceptions.ConnectionError:
        return {"success": False, "message": "Computation engine unavailable"}, 503
    except Exception as e:
        return {"success": False, "message": str(e)}, 500


def _proxy_post_files(path: str, files: dict, data: dict = None):
    """Forward a multipart POST to the computation engine."""
    try:
        r = http_requests.post(
            f"{COMPUTE_BASE}{path}",
            files=files,
            data=data or {},
            timeout=COMPUTE_TIMEOUT,
        )
        return r.json(), r.status_code
    except http_requests.exceptions.ConnectionError:
        return {"success": False, "message": "Computation engine unavailable"}, 503
    except Exception as e:
        return {"success": False, "message": str(e)}, 500


# ──────────────────────────────────────────────
# UPLOAD CONFIG
# ──────────────────────────────────────────────
UPLOAD_ROOT = os.path.join(os.path.dirname(__file__), "uploads")
PROFILE_IMAGE_DIR = os.path.join(UPLOAD_ROOT, "profile_images")
CSV_UPLOAD_DIR = os.path.join(UPLOAD_ROOT, "csv_files")
os.makedirs(PROFILE_IMAGE_DIR, exist_ok=True)
os.makedirs(CSV_UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ALLOWED_CSV_EXTENSIONS = {"csv"}
MAX_CSV_SIZE_MB = 5

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _allowed_image(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


def _allowed_csv(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_CSV_EXTENSIONS


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _is_valid_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email or ""))


def _is_strong_password(password: str) -> bool:
    return isinstance(password, str) and len(password) >= 8


def _safe_user_payload(user_doc: dict) -> dict:
    return {
        "user_id": user_doc.get("user_id"),
        "name": user_doc.get("name", ""),
        "email": user_doc.get("email", ""),
        "profile_image": user_doc.get("profile_image", ""),
        "created_at": user_doc.get("created_at").isoformat() if user_doc.get("created_at") else None,
    }


def _json_error(message: str, status_code: int = 400):
    return jsonify({"success": False, "message": message}), status_code


def _client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


# ──────────────────────────────────────────────
# DATABASE
# ──────────────────────────────────────────────
_MONGO_URI = os.getenv(
    "MONGODB_CONNECTION_STRING",
    "mongodb+srv://someshkumarsahoo28_db_user:lRGYsixqx6boPbKW@bitdata.v5veckh.mongodb.net/",
)
_MONGO_DB = os.getenv("MONGODB_DB_NAME", "moneymirror_db")

try:
    _client = MongoClient(_MONGO_URI, serverSelectionTimeoutMS=5000)
    _db = _client.get_database(_MONGO_DB)

    users_col = _db["users"]
    chat_sessions_col = _db["chat_sessions"]
    auth_events_col = _db["auth_events"]
    api_logs_col = _db["api_logs"]
    analyses_col = _db["analyses"]          # ← NEW: stores every analysis run

    users_col.create_index("user_id", unique=True)
    users_col.create_index("email", unique=True)
    chat_sessions_col.create_index([("user_id", 1), ("session_id", 1)], unique=True)
    auth_events_col.create_index([("email", ASCENDING), ("created_at", DESCENDING)])
    analyses_col.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    analyses_col.create_index("analysis_id", unique=True)

    print("✅ Connected to MongoDB successfully")
    _db_ok = True
except Exception as exc:
    print(f"⚠️  MongoDB connection failed: {exc}")
    users_col = chat_sessions_col = auth_events_col = api_logs_col = analyses_col = None
    _db_ok = False


def _db_ready() -> bool:
    return _db_ok and users_col is not None


# ──────────────────────────────────────────────
# LOGGING HELPERS
# ──────────────────────────────────────────────
SENSITIVE_KEYS = {"password", "new_password", "confirm_password", "otp", "reset_otp_hash", "token"}


def _sanitize(value):
    if isinstance(value, dict):
        return {k: "***" if str(k).lower() in SENSITIVE_KEYS else _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value


def _log_auth(event_type: str, email: str = "", outcome: str = "success", extra: dict = None):
    if auth_events_col is None:
        return
    try:
        auth_events_col.insert_one({
            "event_type": event_type, "email": _normalize_email(email),
            "outcome": outcome, "extra": _sanitize(extra or {}),
            "ip": _client_ip(), "path": request.path,
            "created_at": _utc_now(),
        })
    except Exception:
        pass


@app.before_request
def _before():
    g.started_at = _utc_now()
    if request.is_json:
        g.body = request.get_json(silent=True) or {}
    else:
        g.body = {}


@app.after_request
def _after(response):
    if api_logs_col is not None:
        try:
            duration = int((_utc_now() - g.started_at).total_seconds() * 1000)
            api_logs_col.insert_one({
                "path": request.path, "method": request.method,
                "status_code": response.status_code, "duration_ms": duration,
                "ip": _client_ip(), "created_at": _utc_now(),
            })
        except Exception:
            pass
    return response


# ──────────────────────────────────────────────
# EMAIL / OTP
# ──────────────────────────────────────────────
def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def _send_reset_email(to_email: str, otp: str) -> tuple[bool, str]:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", smtp_user)
    app_name = os.getenv("APP_NAME", "MoneyMirror")
    if not smtp_host or not sender:
        return False, "SMTP not configured"
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{app_name} Password Reset OTP"
        msg["From"] = sender
        msg["To"] = to_email
        html = f"""<html><body style="font-family:Arial,sans-serif">
          <h2>{app_name} Password Reset</h2>
          <p>Your OTP is:</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:4px">{otp}</p>
          <p>Expires in 15 minutes. If you did not request this, ignore this email.</p>
        </body></html>"""
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(sender, to_email, msg.as_string())
        return True, "sent"
    except Exception as e:
        return False, str(e)


# ──────────────────────────────────────────────
# BASIC ROUTES
# ──────────────────────────────────────────────
@app.route("/", methods=["GET"])
def root():
    return jsonify({"success": True, "service": "MoneyMirror API", "status": "running", "time": _utc_now().isoformat()})


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"success": True, "status": "ok", "db": _db_ready(), "timestamp": _utc_now().isoformat()})


# ──────────────────────────────────────────────
# ANALYSIS PERSISTENCE HELPER
# ──────────────────────────────────────────────
import uuid as _uuid

def _save_analysis(user_id, analysis_type: str, payload: dict, result: dict) -> None:
    """
    Persist one analysis snapshot to MongoDB.
    Silently skips if user_id is missing or DB is down.
    analysis_type: 'doctor' | 'twin' | 'subscriptions' | 'interventions'
    """
    if not user_id or not _db_ready() or analyses_col is None:
        return
    try:
        doc = {
            "analysis_id":   str(_uuid.uuid4()),
            "user_id":       str(user_id),
            "analysis_type": analysis_type,
            "created_at":    _utc_now(),
            "month":         payload.get("month"),
            "year":          payload.get("year"),
            # ── Snapshot of key inputs ──
            "inputs": {
                "monthly_income":   payload.get("monthly_income"),
                "monthly_expenses": payload.get("monthly_expenses"),
                "monthly_savings":  payload.get("monthly_savings"),
                "current_savings":  payload.get("current_savings"),
                "transaction_count": len(payload.get("transactions", [])),
            },
            # ── Full result from computation engine ──
            "result": result,
        }
        analyses_col.insert_one(doc)
        print(f"[analysis_store] Saved {analysis_type} for user {user_id}")
    except Exception as e:
        print(f"[analysis_store] Failed to save analysis: {e}")


# ──────────────────────────────────────────────
# FINANCIAL COMPUTATION PROXY ROUTES
# (all calculations done in main.py via numpy/pandas)
# ──────────────────────────────────────────────
@app.route("/analyze-transactions", methods=["POST"])
def proxy_analyze_transactions():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    result, status = _proxy_post("/analyze-transactions", data)
    if status == 200:
        _save_analysis(user_id, "doctor", data, result)
    return jsonify(result), status


@app.route("/detect-subscriptions", methods=["POST"])
def proxy_detect_subscriptions():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    result, status = _proxy_post("/detect-subscriptions", data)
    if status == 200:
        _save_analysis(user_id, "subscriptions", data, result)
    return jsonify(result), status


@app.route("/financial-twin", methods=["POST"])
def proxy_financial_twin():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    result, status = _proxy_post("/financial-twin", data)
    if status == 200:
        _save_analysis(user_id, "twin", data, result)
    return jsonify(result), status


@app.route("/interventions", methods=["POST"])
def proxy_interventions():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    result, status = _proxy_post("/interventions", data)
    if status == 200:
        _save_analysis(user_id, "interventions", data, result)
    return jsonify(result), status


@app.route("/scam-shield", methods=["POST"])
def proxy_scam_shield():
    data = request.get_json(silent=True) or {}
    result, status = _proxy_post("/scam-shield", data)
    return jsonify(result), status


# ──────────────────────────────────────────────
# CSV UPLOAD & PARSE
# ──────────────────────────────────────────────
@app.route("/upload-csv", methods=["POST"])
@app.route("/api/upload-csv", methods=["POST"])
def upload_csv():
    """
    Accept a CSV file, forward it to main.py for parsing.
    Returns structured transactions list.
    """
    csv_file = request.files.get("file")
    if csv_file is None or not csv_file.filename:
        return _json_error("CSV file is required (field: 'file')")
    if not _allowed_csv(csv_file.filename):
        return _json_error("Only .csv files are accepted")

    # Size guard
    csv_file.seek(0, 2)
    size_mb = csv_file.tell() / (1024 * 1024)
    csv_file.seek(0)
    if size_mb > MAX_CSV_SIZE_MB:
        return _json_error(f"File too large. Maximum allowed size is {MAX_CSV_SIZE_MB} MB")

    # Save locally for audit trail
    safe_name = secure_filename(csv_file.filename)
    unique_name = f"csv_{int(time.time() * 1000)}_{random.randint(1000, 9999)}_{safe_name}"
    save_path = os.path.join(CSV_UPLOAD_DIR, unique_name)
    csv_file.save(save_path)

    # Forward to computation engine for parsing
    with open(save_path, "rb") as f:
        result, status = _proxy_post_files(
            "/parse-csv",
            files={"file": (unique_name, f, "text/csv")},
        )

    return jsonify(result), status


# ──────────────────────────────────────────────
# PROFILE IMAGE UPLOAD
# ──────────────────────────────────────────────
@app.route("/uploads/profile_images/<path:filename>", methods=["GET"])
def serve_profile_image(filename):
    return send_from_directory(PROFILE_IMAGE_DIR, filename)


@app.route("/api/user/profile-image", methods=["POST"])
def upload_profile_image():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    user_id = (request.form.get("user_id") or "").strip()
    if not user_id:
        return _json_error("user_id is required")

    img_file = request.files.get("image")
    if img_file is None or not img_file.filename:
        return _json_error("image file is required")
    if not _allowed_image(img_file.filename):
        return _json_error("Unsupported format. Use png/jpg/jpeg/webp")

    safe_name = secure_filename(img_file.filename)
    unique_name = f"profile_{user_id}_{int(time.time())}_{safe_name}"
    save_path = os.path.join(PROFILE_IMAGE_DIR, unique_name)

    try:
        img_file.save(save_path)
    except Exception as e:
        return _json_error(f"Failed to save image: {e}", 500)

    image_url = f"{request.host_url.rstrip('/')}/uploads/profile_images/{unique_name}"

    try:
        users_col.update_one(
            {"user_id": user_id},
            {"$set": {"profile_image": image_url, "updated_at": _utc_now()}},
        )
    except Exception as e:
        return _json_error(f"Image saved but DB update failed: {e}", 500)

    return jsonify({"success": True, "message": "Profile image updated", "image_url": image_url})


# ──────────────────────────────────────────────
# AUTH ROUTES
# ──────────────────────────────────────────────
@app.route("/api/auth/signup", methods=["POST"])
@app.route("/api/signup", methods=["POST"])
@app.route("/signup", methods=["POST"])
def signup():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or data.get("full_name") or "").strip()
    email = _normalize_email(data.get("email", ""))
    password = data.get("password", "")
    confirm_password = data.get("confirm_password") or data.get("confirmPassword") or ""

    if not name:
        return _json_error("Name is required")
    if not _is_valid_email(email):
        return _json_error("Please enter a valid email address")
    if not _is_strong_password(password):
        return _json_error("Password must be at least 8 characters long")
    if confirm_password and password != confirm_password:
        return _json_error("Passwords do not match")

    user_doc = {
        "user_id": f"USR-{int(time.time())}-{random.randint(1000, 9999)}",
        "name": name,
        "email": email,
        "password": generate_password_hash(password),
        "profile_image": "",
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
    }

    try:
        users_col.insert_one(user_doc)
    except DuplicateKeyError:
        _log_auth("signup", email=email, outcome="failed", extra={"reason": "email_exists"})
        return _json_error("An account with this email already exists", 409)
    except Exception as e:
        _log_auth("signup", email=email, outcome="failed", extra={"reason": str(e)})
        return _json_error(f"Could not create account: {e}", 500)

    _log_auth("signup", email=email, outcome="success", extra={"user_id": user_doc["user_id"]})
    return jsonify({"success": True, "message": "Account created successfully", "user": _safe_user_payload(user_doc)}), 201


@app.route("/api/auth/login", methods=["POST"])
@app.route("/api/login", methods=["POST"])
@app.route("/login", methods=["POST"])
def login():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    email = _normalize_email(data.get("email", ""))
    password = data.get("password", "")

    if not _is_valid_email(email):
        return _json_error("Please enter a valid email address")
    if not password:
        return _json_error("Password is required")

    user_doc = users_col.find_one({"email": email})
    if not user_doc or not check_password_hash(user_doc.get("password", ""), password):
        _log_auth("login", email=email, outcome="failed", extra={"reason": "invalid_credentials"})
        return _json_error("Invalid email or password", 401)

    users_col.update_one({"_id": user_doc["_id"]}, {"$set": {"last_login_at": _utc_now(), "updated_at": _utc_now()}})
    _log_auth("login", email=email, outcome="success", extra={"user_id": user_doc.get("user_id")})

    return jsonify({"success": True, "message": "Login successful", "user": _safe_user_payload(user_doc)})


@app.route("/api/auth/forgot-password", methods=["POST"])
@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    email = _normalize_email(data.get("email", ""))

    if not _is_valid_email(email):
        return _json_error("Please enter a valid email address")

    generic = "If the email exists, a reset OTP has been sent"
    user_doc = users_col.find_one({"email": email})
    if not user_doc:
        return jsonify({"success": True, "message": generic})

    otp = _generate_otp()
    expires_at = _utc_now() + timedelta(minutes=15)
    users_col.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"reset_otp_hash": generate_password_hash(otp), "reset_otp_expires_at": expires_at, "updated_at": _utc_now()}},
    )

    sent, reason = _send_reset_email(email, otp)
    resp = {"success": True, "message": generic, "email_sent": sent}
    if os.getenv("APP_ENV", "development").lower() != "production":
        resp["debug_otp"] = otp
        if not sent:
            resp["email_error"] = reason
    return jsonify(resp)


@app.route("/api/auth/verify-reset-otp", methods=["POST"])
def verify_reset_otp():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    email = _normalize_email(data.get("email", ""))
    otp = str(data.get("otp", "")).strip()

    if not _is_valid_email(email):
        return _json_error("Please enter a valid email address")
    if not otp:
        return _json_error("OTP is required")

    user_doc = users_col.find_one({"email": email})
    if not user_doc:
        return _json_error("Invalid OTP", 400)

    otp_hash = user_doc.get("reset_otp_hash")
    otp_expiry = user_doc.get("reset_otp_expires_at")
    if not otp_hash or not otp_expiry:
        return _json_error("No active OTP. Please request a new one", 400)
    if _utc_now() > otp_expiry:
        return _json_error("OTP has expired. Please request a new one", 400)
    if not check_password_hash(otp_hash, otp):
        return _json_error("Invalid OTP", 400)

    return jsonify({"success": True, "message": "OTP verified"})


@app.route("/api/auth/reset-password", methods=["POST"])
@app.route("/reset-password", methods=["POST"])
def reset_password():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    email = _normalize_email(data.get("email", ""))
    otp = str(data.get("otp", "")).strip()
    new_password = data.get("new_password") or data.get("password") or ""

    if not _is_valid_email(email):
        return _json_error("Please enter a valid email address")
    if not otp:
        return _json_error("OTP is required")
    if not _is_strong_password(new_password):
        return _json_error("New password must be at least 8 characters long")

    user_doc = users_col.find_one({"email": email})
    if not user_doc:
        return _json_error("Invalid OTP or email", 400)

    otp_hash = user_doc.get("reset_otp_hash")
    otp_expiry = user_doc.get("reset_otp_expires_at")
    if not otp_hash or not otp_expiry:
        return _json_error("No active OTP. Please request a new one", 400)
    if _utc_now() > otp_expiry:
        return _json_error("OTP has expired. Please request a new one", 400)
    if not check_password_hash(otp_hash, otp):
        return _json_error("Invalid OTP", 400)

    users_col.update_one(
        {"_id": user_doc["_id"]},
        {
            "$set": {"password": generate_password_hash(new_password), "updated_at": _utc_now()},
            "$unset": {"reset_otp_hash": "", "reset_otp_expires_at": ""},
        },
    )
    _log_auth("reset_password", email=email, outcome="success")
    return jsonify({"success": True, "message": "Password reset successful"})


@app.route("/api/auth/me", methods=["POST"])
def me():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    email = _normalize_email(data.get("email", ""))
    if not _is_valid_email(email):
        return _json_error("Please enter a valid email address")

    user_doc = users_col.find_one({"email": email})
    if not user_doc:
        return _json_error("User not found", 404)

    return jsonify({"success": True, "user": _safe_user_payload(user_doc)})


# ──────────────────────────────────────────────
# CHAT HISTORY (for future use)
# ──────────────────────────────────────────────
@app.route("/api/chat/history", methods=["POST"])
def get_chat_history():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    email = _normalize_email(data.get("email", ""))
    limit = int(data.get("limit", 20))

    if not user_id and not _is_valid_email(email):
        return _json_error("user_id or valid email is required")

    if email and not user_id:
        user_doc = users_col.find_one({"email": email})
        if not user_doc:
            return _json_error("User not found", 404)
        user_id = user_doc.get("user_id")

    history = list(
        chat_sessions_col.find(
            {"user_id": user_id},
            {"_id": 1, "session_id": 1, "title": 1, "created_at": 1, "updated_at": 1, "messages": 1},
        )
        .sort("updated_at", DESCENDING)
        .limit(limit)
    )

    result = [
        {
            "_id": str(c["_id"]),
            "session_id": c.get("session_id"),
            "title": (c.get("title") or "Untitled")[:120],
            "created_at": c.get("created_at"),
            "updated_at": c.get("updated_at") or c.get("created_at"),
            "message_count": len(c.get("messages") or []),
        }
        for c in history
    ]

    return jsonify({"success": True, "chat_history": result, "count": len(result)})


@app.route("/api/chat/message", methods=["POST"])
def save_chat_message():
    if not _db_ready():
        return _json_error("Database is not connected", 503)

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    session_id = data.get("session_id")
    text = (data.get("text") or "").strip()
    role = data.get("role", "user")

    if not user_id or not session_id or not text:
        return _json_error("user_id, session_id, and text are required")
    if role not in ("user", "assistant"):
        return _json_error("role must be 'user' or 'assistant'")

    try:
        if not chat_sessions_col.find_one({"user_id": user_id, "session_id": session_id}):
            chat_sessions_col.insert_one({
                "user_id": user_id, "session_id": session_id,
                "title": text[:50], "messages": [],
                "created_at": _utc_now(), "updated_at": _utc_now(),
            })

        chat_sessions_col.update_one(
            {"user_id": user_id, "session_id": session_id},
            {
                "$push": {"messages": {"role": role, "text": text, "timestamp": _utc_now()}},
                "$set": {"updated_at": _utc_now()},
            },
        )
        return jsonify({"success": True, "message": "Message saved", "session_id": session_id})
    except Exception as e:
        return _json_error(f"Failed to save message: {e}", 500)


# ──────────────────────────────────────────────
# ANALYSIS HISTORY & PERSONALIZATION ENDPOINTS
# ──────────────────────────────────────────────

@app.route("/api/analyses", methods=["GET"])
def get_analysis_history():
    """
    GET /api/analyses?user_id=xxx&type=doctor&limit=20&skip=0
    Returns paginated list of saved analyses for a user.
    Used by personalization and history dashboard.
    """
    if not _db_ready():
        return _json_error("Database unavailable", 503)

    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return _json_error("user_id is required")

    analysis_type = request.args.get("type")   # optional filter: doctor|twin|subscriptions|interventions
    try:
        limit = min(int(request.args.get("limit", 20)), 100)
        skip  = max(int(request.args.get("skip",  0)),  0)
    except ValueError:
        limit, skip = 20, 0

    query = {"user_id": user_id}
    if analysis_type:
        query["analysis_type"] = analysis_type

    cursor = (
        analyses_col
        .find(query, {"_id": 0})
        .sort("created_at", DESCENDING)
        .skip(skip)
        .limit(limit)
    )

    docs = []
    for doc in cursor:
        # Serialise datetime for JSON
        if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        docs.append(doc)

    total = analyses_col.count_documents(query)
    return jsonify({"success": True, "total": total, "analyses": docs})


@app.route("/api/analyses/summary", methods=["GET"])
def get_analysis_summary():
    """
    GET /api/analyses/summary?user_id=xxx
    Returns aggregated stats across all doctor analyses for personalization:
      - total analyses run
      - average health score
      - average savings rate
      - trend (latest vs earliest score)
      - most recent analysis date
    """
    if not _db_ready():
        return _json_error("Database unavailable", 503)

    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return _json_error("user_id is required")

    # Only aggregate doctor (health score) analyses
    docs = list(
        analyses_col
        .find({"user_id": user_id, "analysis_type": "doctor"}, {"_id": 0})
        .sort("created_at", ASCENDING)
    )

    if not docs:
        return jsonify({"success": True, "total_analyses": 0, "summary": None})

    scores = [d["result"].get("summary", {}).get("score", 0) for d in docs if "result" in d]
    savings_rates = [
        d["result"].get("doctor_insights", {}).get("savings_rate", 0)
        for d in docs if "result" in d
    ]

    latest = docs[-1]
    earliest = docs[0]

    trend = "stable"
    if len(scores) >= 2:
        diff = scores[-1] - scores[0]
        trend = "improving" if diff > 5 else "declining" if diff < -5 else "stable"

    last_date = latest.get("created_at")
    if hasattr(last_date, "isoformat"):
        last_date = last_date.isoformat()

    return jsonify({
        "success": True,
        "total_analyses": len(docs),
        "summary": {
            "average_health_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "latest_health_score":  scores[-1] if scores else 0,
            "earliest_health_score": scores[0] if scores else 0,
            "avg_savings_rate": round(sum(savings_rates) / len(savings_rates), 1) if savings_rates else 0,
            "trend": trend,
            "last_analysis_date": last_date,
            "months_tracked": len(set(
                (d.get("month") or "") + str(d.get("year") or "")
                for d in docs if d.get("month") or d.get("year")
            )),
        },
    })


# ──────────────────────────────────────────────
# AI CHAT ENDPOINT  (Groq primary → Gemini backup)
# ──────────────────────────────────────────────

# ── Helper: collect non-empty, non-placeholder keys from env ──────────────
_PLACEHOLDERS = {
    "your-groq-api-key-1-here", "your-groq-api-key-2-here", "your-groq-api-key-3-here",
    "your-grok-api-key-1-here", "your-grok-api-key-2-here", "your-grok-api-key-3-here",
    "your-gemini-api-key-2-here", "your-gemini-api-key-3-here",
    "your-gemini-api-key-here", "",
}

def _load_keys(env_names):
    """Return list of keys from env vars, stripping placeholders/empties."""
    keys = []
    for name in env_names:
        val = (os.getenv(name) or "").strip().strip('"').strip("'")
        if val and val not in _PLACEHOLDERS:
            keys.append(val)
    return keys

# ── Load all keys at startup ──────────────────────────────────────────────
GROQ_KEYS   = _load_keys(["GROQ_API_KEY_1", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROK_API_KEY_1", "GROK_API_KEY_2", "GROK_API_KEY_3"])
GEMINI_KEYS = _load_keys([
    "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3",
    "GEMINI_API_KEY",   # legacy single-key name still supported
])

GROQ_MODEL   = (os.getenv("GROQ_MODEL")   or os.getenv("GROK_MODEL") or "llama-3.3-70b-versatile").strip().strip('"')
GEMINI_MODEL = (os.getenv("GEMINI_MODEL") or "gemini-1.5-flash").strip().strip('"')

GROQ_API_BASE   = "https://api.groq.com/openai/v1"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

print(f"🤖 AI keys loaded — Groq: {len(GROQ_KEYS)}, Gemini: {len(GEMINI_KEYS)}")

MONEYMIRROR_SYSTEM_PROMPT = (
    "You are MoneyMirror AI Assistant — a friendly, expert personal finance advisor "
    "built into the MoneyMirror platform. You help Indian users with:\n"
    "• Understanding their financial health scores and expense breakdowns\n"
    "• Interpreting their Financial Twin projections (1, 3, 5-year goals)\n"
    "• Detecting and reducing subscription creep\n"
    "• Protecting themselves from scams (Scam Shield)\n"
    "• Building better saving and investing habits\n"
    "• Any general personal finance, budgeting, investing, or tax questions\n\n"
    "Tone: warm, concise, practical. Avoid jargon. Prefer bullet points for lists.\n"
    "If unsure, say so honestly — never fabricate financial data.\n"
    "Always remind users that your advice is educational and not a substitute for a certified financial planner."
)


# ── Provider: Groq (OpenAI-compatible) ───────────────────────────────
def _try_groq(api_key, message, history):
    """Returns (reply_str, error_str|None). error_str=None means success."""
    msgs = [{"role": "system", "content": MONEYMIRROR_SYSTEM_PROMPT}]
    for turn in history:
        role = turn.get("role", "user")
        # Frontend sends Gemini-style {role, parts:[{text}]} — normalise
        if isinstance(turn.get("parts"), list):
            text = " ".join(p.get("text", "") for p in turn["parts"])
        else:
            text = turn.get("content", "")
        if role == "model":
            role = "assistant"
        if role in ("user", "assistant") and text:
            msgs.append({"role": role, "content": text})
    msgs.append({"role": "user", "content": message})

    try:
        resp = http_requests.post(
            f"{GROQ_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": msgs, "temperature": 0.7, "max_tokens": 1024},
            timeout=30,
        )
        rj = resp.json()
        if resp.status_code != 200:
            return "", f"HTTP {resp.status_code}: {rj.get('error', {}).get('message', 'unknown')}"
        reply = rj.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        return (reply, None) if reply else ("", "empty response")
    except http_requests.exceptions.Timeout:
        return "", "timeout"
    except Exception as exc:
        return "", str(exc)


# ── Provider: Gemini (Google REST) ───────────────────────────────────────
def _try_gemini(api_key, message, history):
    """Returns (reply_str, error_str|None). error_str=None means success."""
    contents = []
    for turn in history:
        role  = turn.get("role", "user")
        parts = turn.get("parts", [])
        if role in ("user", "model") and parts:
            contents.append({"role": role, "parts": parts})
    contents.append({"role": "user", "parts": [{"text": message}]})

    payload = {
        "system_instruction": {"parts": [{"text": MONEYMIRROR_SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024},
    }
    url = f"{GEMINI_API_BASE}/{GEMINI_MODEL}:generateContent?key={api_key}"
    try:
        resp = http_requests.post(url, json=payload, timeout=30)
        rj   = resp.json()
        if resp.status_code != 200:
            return "", f"HTTP {resp.status_code}: {rj.get('error', {}).get('message', 'unknown')}"
        candidates = rj.get("candidates", [])
        reply = ""
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            reply = " ".join(p.get("text", "") for p in parts).strip()
        return (reply, None) if reply else ("", "empty response")
    except http_requests.exceptions.Timeout:
        return "", "timeout"
    except Exception as exc:
        return "", str(exc)


# ── Route ─────────────────────────────────────────────────────────────────
@app.route("/api/chat/ai", methods=["POST"])
def ai_chat():
    """
    POST /api/chat/ai
    Body  : { "message": str, "history": [{role, parts:[{text}]}] }
    Returns: { "success": true, "reply": str, "provider": "groq"|"gemini" }

    Priority order:
      1. GROQ_API_KEY_1 → GROQ_API_KEY_2 → GROQ_API_KEY_3   (Groq)
      2. GEMINI_API_KEY_1 → GEMINI_API_KEY_2 → GEMINI_API_KEY_3  (Google)
    Each key is tried independently; failures are logged and skipped.
    """
    if not GROQ_KEYS and not GEMINI_KEYS:
        return _json_error(
            "No AI API keys configured. Add GROQ_API_KEY_1 / GEMINI_API_KEY_1 to .env", 503
        )

    data    = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    history = data.get("history") or []

    if not message:
        return _json_error("message is required")

    failures = []

    # ── 1. Try all Groq keys (primary) ────────────────────────────────────
    for idx, key in enumerate(GROQ_KEYS, 1):
        reply, err = _try_groq(key, message, history)
        if err is None:
            print(f"[ai_chat] ✅ Groq key #{idx} OK")
            return jsonify({"success": True, "reply": reply, "provider": "groq"})
        print(f"[ai_chat] ⚠️  Groq key #{idx} failed: {err}")
        failures.append(f"groq#{idx}: {err}")

    # ── 2. Try all Gemini keys (backup) ───────────────────────────────────
    for idx, key in enumerate(GEMINI_KEYS, 1):
        reply, err = _try_gemini(key, message, history)
        if err is None:
            print(f"[ai_chat] ✅ Gemini key #{idx} OK (fallback)")
            return jsonify({"success": True, "reply": reply, "provider": "gemini"})
        print(f"[ai_chat] ⚠️  Gemini key #{idx} failed: {err}")
        failures.append(f"gemini#{idx}: {err}")

    # ── 3. All exhausted ──────────────────────────────────────────────────
    print(f"[ai_chat] ❌ All AI keys exhausted: {failures}")
    return _json_error("All AI providers are currently unavailable. Please try again in a moment.", 503)


# ──────────────────────────────────────────────
# VOICE INPUT ENDPOINT (faster-whisper)
# ──────────────────────────────────────────────
from faster_whisper import WhisperModel
import tempfile

# Load the whisper model once on startup
# "tiny.en" is extremely fast and usually good enough for voice commands.
# If you need better accuracy, change to "base.en" or "small.en".
print("🎙️  Loading faster-whisper model (tiny.en)...")

import warnings
warnings.filterwarnings("ignore", module="huggingface_hub")
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

whisper_model = WhisperModel("tiny.en", device="cpu", compute_type="int8")

@app.route("/api/chat/voice", methods=["POST"])
def voice_input():
    if "audio" not in request.files:
        return _json_error("No audio file provided")

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return _json_error("Empty audio file")

    try:
        # Save to a temporary file
        fd, tmp_path = tempfile.mkstemp(suffix=".webm")
        os.close(fd)
        audio_file.save(tmp_path)

        # Transcribe
        segments, info = whisper_model.transcribe(tmp_path, beam_size=5)
        text = " ".join([segment.text for segment in segments]).strip()

        # Clean up temp file
        os.remove(tmp_path)

        return jsonify({"success": True, "text": text})

    except Exception as e:
        print(f"[voice_input] Error: {e}")
        return _json_error(f"Failed to transcribe audio: {e}", 500)


# ──────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8005")), debug=os.getenv("FLASK_DEBUG", "1") == "1")
