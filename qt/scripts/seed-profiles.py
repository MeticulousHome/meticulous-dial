#!/usr/bin/env python3
"""Copies profiles into a (test) backend: from another machine's backend, or N copies of its "Simple".

    seed-profiles.py --to http://127.0.0.1:18080 --from http://10.10.0.130:8080 [--limit 12]
    seed-profiles.py --to http://127.0.0.1:18080 --copies 5
"""
import argparse
import json
import urllib.request
import uuid


def get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.load(r)


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--to", required=True)
    p.add_argument("--from", dest="source")
    p.add_argument("--limit", type=int, default=12)
    p.add_argument("--copies", type=int, default=0)
    a = p.parse_args()
    profiles = []
    if a.source:
        profiles = get(a.source + "/api/v1/profile/list?full=true")[: a.limit]
    if a.copies:
        simple = get(a.to + "/api/v1/profile/defaults")["default"][0]
        images = get(a.to + "/api/v1/profile/image")
        for n in range(a.copies):
            profiles.append({**simple, "id": str(uuid.uuid4()), "name": f"Test profile {n + 1}",
                             "display": {**simple.get("display", {}), "image": "/api/v1/profile/image/" + images[n % len(images)]}})
    for profile in profiles:
        post(a.to + "/api/v1/profile/save", profile)
        print("saved", profile["name"])


if __name__ == "__main__":
    main()
