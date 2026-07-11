#!/usr/bin/env python3
"""Send a locally produced question-import.v2 JSON to the private queue."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sys
import time
import urllib.request


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: ingest_client.py <exam.json> <https://host/api/internal/questions/ingest.php>", file=sys.stderr)
        return 2
    secret = os.environ.get("QUESTION_INGESTION_SECRET", "").strip()
    client_key = os.environ.get("QUESTION_INGESTION_CLIENT_KEY", "local-crawler").strip()
    if not secret:
        print("QUESTION_INGESTION_SECRET is required", file=sys.stderr)
        return 2
    raw = open(sys.argv[1], "rb").read()
    payload = json.loads(raw)
    if payload.get("schemaVersion") != "question-import.v2":
        print("input must use schemaVersion question-import.v2", file=sys.stderr)
        return 2
    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(24)
    signature = hmac.new(secret.encode(), timestamp.encode() + b"." + nonce.encode() + b"." + raw, hashlib.sha256).hexdigest()
    request = urllib.request.Request(
        sys.argv[2],
        data=raw,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Question-Ingest-Key": client_key,
            "X-Question-Ingest-Timestamp": timestamp,
            "X-Question-Ingest-Nonce": nonce,
            "X-Question-Ingest-Signature": signature,
            "Idempotency-Key": hashlib.sha256(raw).hexdigest(),
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        print(response.read().decode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
