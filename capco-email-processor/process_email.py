#!/usr/bin/env python3
"""
CAPCO Email Processor v2
Connects to agent@capcofire.com via IMAP, processes incoming emails.
Creates profiles, projects, uploads attachments to Supabase.
Triggers status changes via the live capcofire.com API.
"""

import json
import re
import sys
import os
import base64
import uuid
import time
import secrets
import string
import imaplib
import email as emaillib
from email import policy
from email.utils import parseaddr
from datetime import datetime, timezone
import urllib.request
import urllib.parse
import urllib.error
import subprocess
import tempfile

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qudlxlryegnainztkrtk.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BUCKET = "project-media"
SITE_URL = "https://capcofire.com"

IMAP_HOST = "imap.gmail.com"
IMAP_USER = os.environ.get("IMAP_USER", "agent@capcofire.com")
IMAP_PASS = os.environ.get("IMAP_PASS")

# Admin user for API auth
ADMIN_EMAIL = "thomas@reave.app"
ADMIN_USER_ID = "d139626c-47dd-46ea-bd63-7948a15ed9c7"

# Internal/staff domains — these are NOT clients
STAFF_DOMAINS = ["capcofire.com", "eliteweblabs.com", "tomsens.com"]
SKIP_DOMAINS = STAFF_DOMAINS + ["google.com", "accounts.google.com"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


# ============================================================
# Supabase helpers
# ============================================================
def sb_get(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def sb_insert(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def sb_update(table, match_col, match_val, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{match_col}=eq.{urllib.parse.quote(str(match_val))}"
    body = json.dumps(data).encode()
    h = dict(HEADERS)
    h["Prefer"] = "return=representation"
    req = urllib.request.Request(url, data=body, headers=h, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def sb_upload(bucket, path, file_bytes, content_type="application/octet-stream"):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
    }
    req = urllib.request.Request(url, data=file_bytes, headers=h, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


# ============================================================
# IMAP helpers
# ============================================================
def fetch_new_emails(since_uid=None):
    """Fetch new emails from IMAP. Returns list of (uid, email.Message)."""
    imap = imaplib.IMAP4_SSL(IMAP_HOST)
    imap.login(IMAP_USER, IMAP_PASS)
    imap.select("INBOX")

    # Search for unseen messages
    result, data = imap.search(None, "UNSEEN")
    if not data[0]:
        imap.logout()
        return []

    messages = []
    for num in data[0].split():
        result, msg_data = imap.fetch(num, "(RFC822)")
        msg = emaillib.message_from_bytes(msg_data[0][1], policy=policy.default)
        messages.append((num.decode(), msg))
        # Mark as seen
        imap.store(num, "+FLAGS", "\\Seen")

    imap.logout()
    return messages


# ============================================================
# Email Parsing
# ============================================================
def extract_email_addresses(text):
    """Find email addresses in text."""
    return re.findall(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)


def extract_sender_info(msg):
    """Extract the external client from a parsed email.Message.
    Handles forwarded emails by scanning all From: references."""
    info = {"email": None, "name": None, "company": None}

    # Get the raw text for scanning (limit to headers + first part to avoid base64 attachment data)
    text = str(msg)[:10000]

    # Collect all "Name <email>" candidates
    candidates = []

    # From header
    from_name, from_addr = parseaddr(msg["From"] or "")
    if from_addr:
        candidates.append({"name": from_name or None, "email": from_addr})

    # All From: lines in body (forwarded messages)
    from_lines = re.findall(r'From:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
    for line in from_lines:
        m = re.search(r'(.+?)\s*<(.+?)>', line)
        if m:
            candidates.append({"name": m.group(1).strip().strip('"*'), "email": m.group(2).strip()})
        else:
            for e in extract_email_addresses(line):
                candidates.append({"name": None, "email": e})

    # "Name <email>" patterns in body
    for name, addr in re.findall(r'([A-Z][\w\s]+?)\s*<([\w.+-]+@[\w.-]+)>', text):
        candidates.append({"name": name.strip(), "email": addr})

    # Pick first non-staff candidate
    for c in candidates:
        domain = c["email"].split("@")[-1].lower()
        if domain not in SKIP_DOMAINS:
            info["email"] = c["email"]
            info["name"] = c["name"]
            break

    # Fallback: any non-staff email in entire text
    if not info["email"]:
        for e in extract_email_addresses(text):
            domain = e.split("@")[-1].lower()
            if domain not in SKIP_DOMAINS:
                info["email"] = e
                break

    return info


# Greater Boston area towns/cities for bias matching
MA_TOWNS = {
    "boston", "cambridge", "somerville", "brookline", "newton", "quincy",
    "braintree", "weymouth", "dedham", "needham", "wellesley", "waltham",
    "watertown", "arlington", "medford", "malden", "everett", "revere",
    "chelsea", "winthrop", "milton", "dorchester", "roxbury", "brighton",
    "allston", "jamaica plain", "roslindale", "mattapan", "hyde park",
    "charlestown", "south boston", "east boston", "back bay", "beacon hill",
    "framingham", "natick", "marlborough", "hudson", "sudbury", "wayland",
    "concord", "lexington", "bedford", "burlington", "woburn", "stoneham",
    "reading", "wakefield", "melrose", "saugus", "lynn", "peabody",
    "salem", "beverly", "danvers", "gloucester", "rockport", "marblehead",
    "swampscott", "nahant", "ipswich", "newburyport", "haverhill",
    "lawrence", "lowell", "dracut", "tewksbury", "billerica", "chelmsford",
    "andover", "north andover", "methuen", "acton", "maynard", "stow",
    "littleton", "westford", "groton", "ayer", "shirley", "fitchburg",
    "leominster", "worcester", "shrewsbury", "westborough", "southborough",
    "hopkinton", "ashland", "holliston", "medway", "milford", "franklin",
    "norwood", "canton", "stoughton", "randolph", "avon", "holbrook",
    "abington", "whitman", "hanover", "hingham", "cohasset", "scituate",
    "marshfield", "duxbury", "plymouth", "kingston", "pembroke",
    "brockton", "easton", "bridgewater", "taunton", "attleboro",
    "fall river", "new bedford", "plymouth", "barnstable", "falmouth",
    "sandwich", "bourne", "wareham", "middleborough", "lakeville",
    "raynham", "norton", "mansfield", "foxborough", "wrentham",
    "plainville", "north attleboro", "seekonk", "rehoboth", "dighton",
    "berkley", "freetown", "acushnet", "fairhaven", "dartmouth",
    "westport", "swansea", "somerset", "cape cod", "nantucket",
    "martha's vineyard", "springfield", "holyoke", "chicopee",
    "northampton", "amherst", "pittsfield", "great barrington",
    "boxford", "topsfield", "essex", "wenham", "hamilton", "middleton",
    "lynnfield", "wilmington", "norfolk", "medfield", "millis",
    "sherborn", "dover", "lincoln", "carlisle", "townsend", "pepperell",
    "dunstable", "georgetown", "groveland", "merrimac", "salisbury",
    "west newbury", "rowley", "newbury", "bolton", "berlin", "boylston",
    "west boylston", "sterling", "hull", "hanson", "carver",
    "rochester", "mattapoisett", "marion", "belmont", "walpole",
    "winchester", "westwood", "sharon", "foxboro", "norton",
    "bellingham", "auburn", "webster", "clinton", "grafton",
    "uxbridge", "oxford", "charlton", "ludlow", "wilbraham",
    "east bridgewater", "west bridgewater", "whitinsville",
}


def extract_physical_address(text):
    """Extract a US physical/street address from text.
    Biased toward Greater Boston / Massachusetts area."""
    STATES = r'(?:MA|CT|NH|RI|VT|ME|NY|NJ|PA|DE|MD|VA|WV|NC|SC|GA|FL|AL|MS|TN|KY|OH|IN|IL|WI|MI|MN|IA|MO|AR|LA|TX|OK|KS|NE|SD|ND|MT|WY|CO|NM|AZ|UT|NV|ID|WA|OR|CA|HI|AK|DC)'
    STREET_SUF = r'(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir|Terrace|Ter|Pike|Highway|Hwy|Parkway|Pkwy|Loop|Trail|Square|Sq)'
    
    patterns = [
        # Full: "123 Main Street, City, ST 01234"
        r'\d+\s+[\w ]+?' + STREET_SUF + r'\.?,?\s+[\w ]+?,\s*' + STATES + r'\s+\d{5}(?:-\d{4})?',
        # "123 Main St, City, MA"
        r'\d+\s+[\w ]+?' + STREET_SUF + r'\.?,?\s+[\w ]+?,\s*' + STATES + r'\b',
        # "62 Pond St. Ashland, MA" (period after St, no comma before city)
        r'\d+\s+[\w ]+?(?:St\.|Ave\.|Rd\.|Dr\.|Blvd\.|Ln\.)\s+[\w ]+?,?\s*' + STATES + r'\b',
        # "123 Whatever, City, ST"
        r'\d+\s+[A-Z][\w .]{3,25},\s*[A-Z][\w ]{2,15},\s*[A-Z]{2}(?:\s+\d{5})?\b',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip().rstrip(',')

    # No-comma pattern: "85 Tremont Street Cambridge MA" (common in filenames)
    STATES_LIST = ['MA', 'CT', 'NH', 'RI', 'VT', 'ME', 'NY', 'NJ', 'PA']
    m = re.search(
        r'(\d+\s+[\w ]+?' + STREET_SUF + r')\s+([\w ]+?)\s+(' + '|'.join(STATES_LIST) + r')\b',
        text, re.IGNORECASE
    )
    if m:
        return f"{m.group(1).strip()}, {m.group(2).strip()}, {m.group(3).upper()}"

    # Fallback: look for known MA town names near a street address
    # Build town pattern (longest first to match "north andover" before "andover")
    towns_pattern = '|'.join(re.escape(t) for t in sorted(MA_TOWNS, key=len, reverse=True))
    
    # "123 Main St, Beverly" or "123 Main St Beverly"
    street_suffixes = r'(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir|Terrace|Ter|Pike|Highway|Hwy|Parkway|Pkwy)'
    m = re.search(
        r'(\d+\s+[\w ]+?' + street_suffixes + r'\.?)\s*[,\s]\s*(' + towns_pattern + r')(?:\s*[,.\n]|\s+(?:for|is|the|to|please|project)\b|\s*$)',
        text, re.IGNORECASE
    )
    if m:
        return f"{m.group(1).strip()}, {m.group(2).strip()}, MA"

    # "88 Beacon, Boston" — no street suffix but known town
    m2 = re.search(
        r'(\d+\s+[A-Z][\w ]{2,25}?)\s*[,]\s*(' + towns_pattern + r')(?:\s*[,.\n]|\s+(?:for|is|the|to|please|project)\b|\s*$)',
        text, re.IGNORECASE
    )
    if m2:
        return f"{m2.group(1).strip()}, {m2.group(2).strip()}, MA"

    return None


def get_email_body(msg):
    """Get plain text body from email message."""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain":
                return part.get_content()
        # Fallback to HTML
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/html":
                html = part.get_content()
                # Basic HTML strip
                text = re.sub(r'<[^>]+>', ' ', html)
                text = re.sub(r'\s+', ' ', text)
                return text
    else:
        return msg.get_content()
    return ""


def get_attachments(msg):
    """Extract attachments from email. Returns list of dicts."""
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            fn = part.get_filename()
            if fn:
                data = part.get_payload(decode=True)
                if data:
                    attachments.append({
                        "filename": fn,
                        "content_type": part.get_content_type(),
                        "data": data,
                        "size": len(data),
                    })
    return attachments


# ============================================================
# PDF text extraction
# ============================================================
def extract_text_from_pdf(pdf_bytes):
    """Extract text from a PDF. Tries pdftotext first, falls back to OCR."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            tmp_path = f.name
        
        # Try pdftotext first (fast, works on text-based PDFs)
        result = subprocess.run(
            ["pdftotext", "-l", "3", tmp_path, "-"],
            capture_output=True, text=True, timeout=15
        )
        text = result.stdout.strip() if result.returncode == 0 else ""
        
        # If barely any text, try OCR (for scanned documents)
        if len(text) < 50:
            # Convert first page to image, then OCR
            img_path = tmp_path.replace(".pdf", ".png")
            # Use sips or convert PDF page 1 to image for tesseract
            subprocess.run(
                ["sips", "-s", "format", "png", "--resampleWidth", "2000",
                 tmp_path, "--out", img_path],
                capture_output=True, timeout=30
            )
            if os.path.exists(img_path):
                ocr_result = subprocess.run(
                    ["tesseract", img_path, "stdout", "--psm", "3"],
                    capture_output=True, text=True, timeout=30
                )
                if ocr_result.returncode == 0:
                    text = ocr_result.stdout.strip()
                os.unlink(img_path)
        
        return text
    except Exception as e:
        print(f"⚠️ PDF extraction error: {e}")
        return ""
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def extract_address_from_attachments(attachments):
    """Scan attachments for a physical address. Checks filenames first, then PDF content."""
    # First pass: check filenames (fast)
    for att in attachments:
        address = extract_physical_address(att["filename"])
        if address:
            return address
    
    # Second pass: extract text from PDFs
    for att in attachments:
        if att["content_type"] == "application/pdf" or att["filename"].lower().endswith(".pdf"):
            text = extract_text_from_pdf(att["data"])
            if text:
                address = extract_physical_address(text)
                if address:
                    return address
    return None


# ============================================================
# Matching
# ============================================================
def normalize_address(addr):
    """Normalize address for fuzzy matching."""
    if not addr:
        return ""
    addr = addr.lower().strip()
    replacements = {
        "street": "st", "avenue": "ave", "road": "rd",
        "drive": "dr", "boulevard": "blvd", "lane": "ln",
        "court": "ct", "place": "pl",
    }
    for full, abbr in replacements.items():
        addr = addr.replace(full, abbr)
    addr = re.sub(r'[,.\s]+', ' ', addr).strip()
    return addr


def match_project(address, projects):
    """Try to match an address against existing projects.
    Returns (match, ambiguous_list) — ambiguous_list has >1 entries if multiple match."""
    if not address:
        return None, []
    norm = normalize_address(address)
    street_match = re.match(r'(\d+\s+\w+)', norm)
    street_key = street_match.group(1) if street_match else norm[:20]

    matches = []
    for p in projects:
        if not p.get("address"):
            continue
        p_norm = normalize_address(p["address"])
        if street_key in p_norm or p_norm in norm:
            matches.append(p)

    if len(matches) == 1:
        return matches[0], []
    elif len(matches) > 1:
        return None, matches  # Ambiguous — needs confirmation
    return None, []


def find_profile(email_addr):
    """Check if a profile exists for this email."""
    results = sb_get("profiles", f"email=eq.{urllib.parse.quote(email_addr)}&limit=1")
    return results[0] if results else None


# ============================================================
# Auth user creation
# ============================================================
def create_auth_user(email_addr, first_name="", last_name=""):
    """Create a Supabase auth user. Returns user dict with 'id' or None."""
    pw = ''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$') for _ in range(20))

    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    body = json.dumps({
        "email": email_addr.strip().lower(),
        "password": pw,
        "email_confirm": True,
        "user_metadata": {
            "firstName": first_name,
            "lastName": last_name,
        },
    }).encode()

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"❌ Auth user creation error: {e.code} - {e.read().decode()}")
        return None


# ============================================================
# API Auth - get session cookies via magic link
# ============================================================
def get_api_session():
    """Generate a magic link token and authenticate to get session cookies."""
    token = str(uuid.uuid4())

    # Insert token
    sb_insert("magicLinkTokens", {
        "token": token,
        "email": ADMIN_EMAIL,
        "redirectTo": "/dashboard",
        "expiresAt": datetime.now(timezone.utc).replace(hour=23, minute=59, second=59).isoformat(),
    })

    # Hit verify endpoint, capture cookies
    url = f"{SITE_URL}/api/auth/verify-custom?token={token}&email={urllib.parse.quote(ADMIN_EMAIL)}&redirect=/dashboard"
    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", "CAPCO-Agent/1.0")

    try:
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
        # Don't follow redirects - just grab cookies from first response
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        opener = urllib.request.build_opener(NoRedirect, urllib.request.HTTPCookieProcessor())
        try:
            opener.open(req)
        except urllib.error.HTTPError as e:
            # 302 redirect is expected
            if e.code == 302:
                cookies = e.headers.get_all("Set-Cookie")
                cookie_dict = {}
                for c in cookies:
                    parts = c.split(";")[0]
                    k, v = parts.split("=", 1)
                    cookie_dict[k.strip()] = v.strip()
                return cookie_dict
            raise
    except Exception as e:
        print(f"❌ Auth error: {e}")
        return None


def call_status_api(project_data, new_status, cookies):
    """Call the status upsert API on capcofire.com."""
    url = f"{SITE_URL}/api/status/upsert"
    body = json.dumps({
        "currentProject": project_data,
        "newStatus": new_status,
    }).encode()

    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Cookie", cookie_str)

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


# ============================================================
# Main Processing
# ============================================================
def process_email_message(msg):
    """Process a single email.Message and return structured results."""
    results = {
        "extracted": {},
        "profile": {"found": False, "created": False, "data": None},
        "project": {"found": False, "created": False, "data": None},
        "attachments": {"count": 0, "uploaded": []},
        "status_update": None,
        "actions_taken": [],
        "needs_review": [],
    }

    body = get_email_body(msg)
    full_text = f"{msg.get('Subject', '')}\n{body}"

    # 1. Extract info
    sender = extract_sender_info(msg)
    address = extract_physical_address(full_text)
    subject = msg.get("Subject", "")
    attachments = get_attachments(msg)

    # If no address in email text, scan PDF attachments
    address_source = "email"
    if not address and attachments:
        address = extract_address_from_attachments(attachments)
        if address:
            address_source = "pdf_attachment"

    results["extracted"] = {
        "sender": sender,
        "address": address,
        "address_source": address_source,
        "subject": subject,
        "attachment_count": len(attachments),
    }

    # 2. Profile lookup/create
    if sender["email"]:
        profile = find_profile(sender["email"])
        if profile:
            results["profile"]["found"] = True
            results["profile"]["data"] = profile
            results["actions_taken"].append(
                f"✅ Found profile: {profile.get('firstName','')} {profile.get('lastName','')} "
                f"({profile['email']}) - {profile.get('role','')}"
            )
        else:
            # Parse name — only split if clearly "First Last" format
            # Don't guess last names from email aliases or single words
            first_name, last_name = "", ""
            if sender["name"]:
                # Clean up common artifacts
                clean_name = re.sub(r'[/\\|"*]', '', sender["name"]).strip()
                parts = clean_name.split()
                if len(parts) >= 2:
                    first_name = parts[0]
                    last_name = " ".join(parts[1:])
                elif len(parts) == 1:
                    first_name = parts[0]
                    last_name = ""  # Don't guess
            
            # Fallback: try first.last@domain pattern
            if not last_name and sender["email"]:
                local = sender["email"].split("@")[0]
                if "." in local:
                    parts = local.split(".")
                    if len(parts) == 2 and parts[0].isalpha() and parts[1].isalpha():
                        if not first_name:
                            first_name = parts[0].capitalize()
                        last_name = parts[1].capitalize()

            domain = sender["email"].split("@")[-1].lower()
            role = "Staff" if domain in STAFF_DOMAINS else "Client"

            # Step 1: Create auth user (DB trigger auto-creates profile)
            auth_user = create_auth_user(sender["email"], first_name, last_name)
            if auth_user:
                # Step 2: Update the auto-created profile with role and any extra data
                import time as _time
                _time.sleep(0.5)  # Brief pause for trigger to complete
                try:
                    updated = sb_update("profiles", "id", auth_user["id"], {"role": role})
                    profile_data = updated[0] if isinstance(updated, list) and updated else {"id": auth_user["id"], "email": sender["email"]}
                except Exception:
                    profile_data = {"id": auth_user["id"], "email": sender["email"]}
                
                results["profile"]["created"] = True
                results["profile"]["data"] = profile_data
                results["actions_taken"].append(
                    f"🆕 Created auth + profile: {first_name} {last_name} <{sender['email']}> as {role}"
                )
            else:
                results["needs_review"].append(f"⚠️ Failed to create auth user for {sender['email']}")
    else:
        results["needs_review"].append("⚠️ Could not extract sender email")

    # 3. Project lookup/create
    all_projects = sb_get("projects", "select=id,address,title,status,authorId,sqFt,building,service,tier")

    if address:
        matched, ambiguous = match_project(address, all_projects)
        if ambiguous:
            results["needs_review"].append(
                f"⚠️ Multiple projects match '{address}':\n"
                + "\n".join(f"  - #{p['id']}: {p.get('address','')}" for p in ambiguous)
            )
        elif matched:
            results["project"]["found"] = True
            results["project"]["data"] = matched
            results["actions_taken"].append(
                f"✅ Matched project #{matched['id']}: {matched.get('address','')}"
            )
        else:
            # Create new project (match fields from /api/projects/upsert)
            author_id = results["profile"]["data"].get("id") if results["profile"]["data"] else None
            # Extract street name for siteAccess/exteriorBeacon
            street_part = address.split(",")[0].strip() if address else None
            now = datetime.now(timezone.utc).isoformat()
            new_project = {
                "address": address,
                "title": address,
                "status": 10,  # Files Hold — successful new project
                "authorId": author_id,
                "siteAccess": street_part,
                "exteriorBeacon": street_part,
                "newConstruction": False,
                "building": [],
                "project": [],
                "tier": [],
                "service": [],
                "requestedDocs": [],
                "createdAt": now,
                "updatedAt": now,
            }

            created = sb_insert("projects", new_project)
            if created:
                proj = created[0] if isinstance(created, list) else created
                results["project"]["created"] = True
                results["project"]["data"] = proj
                results["actions_taken"].append(
                    f"🆕 Created project #{proj.get('id','?')}: {address}"
                )
            else:
                results["needs_review"].append(f"⚠️ Failed to create project for {address}")
    else:
        results["needs_review"].append("⚠️ No physical address found. Check attachments manually.")

    # 4. Upload attachments
    project_data = results["project"]["data"]
    if project_data and attachments:
        project_id = project_data.get("id")
        results["attachments"]["count"] = len(attachments)

        for att in attachments:
            try:
                # Generate unique filename
                ts = int(time.time() * 1000)
                safe_name = re.sub(r'[^a-zA-Z0-9._-]', '-', att["filename"])
                storage_path = f"{project_id}/documents/{ts}-{safe_name}"

                # Upload to storage
                sb_upload(BUCKET, storage_path, att["data"], att["content_type"])

                # Create files record
                file_record = {
                    "projectId": project_id,
                    "fileName": att["filename"],
                    "filePath": storage_path,
                    "fileSize": att["size"],
                    "fileType": att["content_type"],
                    "bucketName": BUCKET,
                    "targetLocation": "documents",
                    "title": att["filename"],
                    "status": "active",
                    "isCurrentVersion": True,
                    "versionNumber": 1,
                    "uploadedAt": datetime.now(timezone.utc).isoformat(),
                }
                sb_insert("files", file_record)

                results["attachments"]["uploaded"].append(att["filename"])
                results["actions_taken"].append(
                    f"📎 Uploaded: {att['filename']} ({att['size']} bytes) → project #{project_id}"
                )
            except Exception as e:
                results["needs_review"].append(f"⚠️ Failed to upload {att['filename']}: {e}")

    return results


def format_report(results):
    """Format results as a readable report."""
    r = results
    lines = ["## 📧 Email Processing Report\n"]

    ext = r["extracted"]
    lines.append("### Extracted Data")
    lines.append(f"- **From:** {ext['sender'].get('name', '?')} <{ext['sender'].get('email', '?')}>")
    lines.append(f"- **Subject:** {ext.get('subject', 'none')}")
    lines.append(f"- **Address:** {ext.get('address', 'none found')}")
    lines.append(f"- **Attachments:** {ext.get('attachment_count', 0)}")
    lines.append("")

    lines.append("### Actions Taken")
    for a in r["actions_taken"]:
        lines.append(f"- {a}")
    lines.append("")

    if r["needs_review"]:
        lines.append("### ⚠️ Needs Review")
        for n in r["needs_review"]:
            lines.append(f"- {n}")
        lines.append("")

    if r["profile"]["data"]:
        status = "FOUND" if r["profile"]["found"] else "CREATED"
        lines.append(f"### Profile ({status})")
        lines.append(f"```json\n{json.dumps(r['profile']['data'], indent=2, default=str)}\n```")

    if r["project"]["data"]:
        status = "FOUND" if r["project"]["found"] else "CREATED"
        lines.append(f"### Project ({status})")
        lines.append(f"```json\n{json.dumps(r['project']['data'], indent=2, default=str)}\n```")

    if r["attachments"]["uploaded"]:
        lines.append("### Uploaded Files")
        for f in r["attachments"]["uploaded"]:
            lines.append(f"- 📎 {f}")

    return "\n".join(lines)


# ============================================================
# CLI entry points
# ============================================================
def check_inbox():
    """Check inbox for new emails and process them."""
    messages = fetch_new_emails()
    if not messages:
        print("📭 No new emails")
        return []

    print(f"📬 Found {len(messages)} new email(s)\n")
    all_results = []

    for uid, msg in messages:
        # Skip Google notification emails
        from_addr = parseaddr(msg.get("From", ""))[1]
        if from_addr and "google.com" in from_addr.lower():
            print(f"⏭️  Skipping Google notification: {msg.get('Subject', '')}")
            continue

        print(f"Processing: {msg.get('Subject', 'no subject')}")
        print(f"  From: {msg.get('From', 'unknown')}")
        print("-" * 60)

        results = process_email_message(msg)
        all_results.append(results)
        print(format_report(results))
        print("=" * 60)

    return all_results


def process_raw_text(text):
    """Process raw email text (pasted/piped). For backward compat."""
    msg = emaillib.message_from_string(text, policy=policy.default)
    results = process_email_message(msg)
    print(format_report(results))
    return results


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        check_inbox()
    elif len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            process_raw_text(f.read())
    else:
        process_raw_text(sys.stdin.read())
