"""Dev helper: create a Clerk test user + session token and a sample PDF for end-to-end checks."""
import json
import os
import sys
import urllib.request

from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
SK = os.environ["CLERK_SECRET_KEY"]


def bapi(path, body=None, method="POST"):
    req = urllib.request.Request("https://api.clerk.com/v1" + path, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "emergent-test"})
    return json.load(urllib.request.urlopen(req))


def user_id(email):
    found = bapi(f"/users?email_address={urllib.parse.quote(email)}", method="GET")
    if found:
        return found[0]["id"]
    return bapi("/users", {"email_address": [email], "password": "Test-pass-12345!", "skip_password_checks": True})["id"]


if __name__ == "__main__":
    import urllib.parse
    email = sys.argv[1] if len(sys.argv) > 1 else "nexus.tester+clerk_test@example.com"
    uid = user_id(email)
    if len(sys.argv) > 2 and sys.argv[2] == "ticket":
        print(bapi("/sign_in_tokens", {"user_id": uid, "expires_in_seconds": 3600})["token"])
    else:
        sid = bapi("/sessions", {"user_id": uid})["id"]
        print(bapi(f"/sessions/{sid}/tokens", {"expires_in_seconds": 3600})["jwt"])
