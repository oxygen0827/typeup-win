#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shlex
import time
import urllib.error
import urllib.parse
import urllib.request

import paramiko


REMOTE_DIR = "/home/wq/static-site-deployer/data/sites/typeup-win-release"
APPS_JSON = "/home/wq/static-site-deployer/data/apps.json"
PUBLIC_BASE_URL = "http://150.158.146.192:6052/apps/typeup-win-release"


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(client, command, timeout=120):
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if code:
        raise RuntimeError(f"remote command failed ({code}): {command}\n{err}\n{out}")
    return out


def public_url(base_url, name):
    return f"{base_url.rstrip('/')}/{urllib.parse.quote(name)}"


def build_manifest(version, installer, blockmap, latest, public_base_url, alternate_urls):
    published_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    installer_sha256 = sha256_file(installer)
    blockmap_sha256 = sha256_file(blockmap)
    latest_sha256 = sha256_file(latest)
    installer_url = public_url(public_base_url, installer.name)
    blockmap_url = public_url(public_base_url, blockmap.name)
    return {
        "schemaVersion": 1,
        "app": "typeup-win",
        "version": version,
        "releaseName": f"TypeUp {version}",
        "publishedAt": published_at,
        "releaseUrl": public_base_url.rstrip("/") + "/",
        "installerName": installer.name,
        "installerUrl": installer_url,
        "installerSize": installer.stat().st_size,
        "sha256": installer_sha256,
        "alternateUrls": alternate_urls,
        "blockmapUrl": blockmap_url,
        "files": {
            "windows": {
                "name": installer.name,
                "url": installer_url,
                "size": installer.stat().st_size,
                "sha256": installer_sha256,
                "blockmapName": blockmap.name,
                "blockmapUrl": blockmap_url,
                "blockmapSize": blockmap.stat().st_size,
                "blockmapSha256": blockmap_sha256,
            },
            "latest": {
                "name": latest.name,
                "size": latest.stat().st_size,
                "sha256": latest_sha256,
            },
        },
    }


def validate_artifacts(version, release_dir, public_base_url, alternate_urls):
    installer = release_dir / f"TypeUp-Setup-{version}.exe"
    blockmap = release_dir / f"TypeUp-Setup-{version}.exe.blockmap"
    latest = release_dir / "latest.yml"
    for path in (installer, blockmap, latest):
        if not path.exists():
            raise SystemExit(f"Missing release artifact: {path}")
        if path.stat().st_size <= 0:
            raise SystemExit(f"Release artifact is empty: {path}")

    latest_text = latest.read_text(encoding="utf-8")
    if f"version: {version}" not in latest_text or installer.name not in latest_text:
        raise SystemExit(f"latest.yml does not describe {installer.name}")

    manifest = build_manifest(version, installer, blockmap, latest, public_base_url, alternate_urls)
    manifest_path = release_dir / "typeup-update.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return installer, blockmap, latest, manifest_path, manifest


def connect(args):
    password = os.environ.get(args.password_env)
    if not password:
        raise SystemExit(f"Set {args.password_env} before running this script.")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        args.host,
        port=args.port,
        username=args.user,
        password=password,
        timeout=20,
        banner_timeout=20,
        auth_timeout=20,
    )
    return client


def upload_snapshot(client, artifacts, manifest, version):
    release_name = f"{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d-%H%M%S')}-v{version}"
    remote_release = f"{REMOTE_DIR}/releases/{release_name}"
    run(client, f"mkdir -p {shlex.quote(remote_release)}")
    sftp = client.open_sftp()
    try:
        for path in artifacts:
            remote = f"{remote_release}/{path.name}"
            print(f"upload {path.name} -> releases/{release_name}/")
            sftp.put(str(path), remote)
    finally:
        sftp.close()

    remote_hashes = parse_sha256sum_output(run(
        client,
        "cd {release} && sha256sum {files}".format(
            release=shlex.quote(remote_release),
            files=" ".join(shlex.quote(path.name) for path in artifacts),
        ),
    ))
    expected = {path.name: sha256_file(path) for path in artifacts}
    for name, digest in expected.items():
        if remote_hashes.get(name) != digest:
            raise RuntimeError(f"remote sha256 mismatch for {name}")

    switch_current(client, release_name, manifest)
    return release_name


def parse_sha256sum_output(output):
    result = {}
    for line in output.splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2:
            result[Path(parts[1]).name] = parts[0].lower()
    return result


def switch_current(client, release_name, manifest):
    command = f"""
set -e
ROOT={shlex.quote(REMOTE_DIR)}
REL={shlex.quote('releases/' + release_name)}
ln -sfn "$REL" "$ROOT/current.next"
mv -Tf "$ROOT/current.next" "$ROOT/current"
python3 - <<'PY'
import json, pathlib, datetime
apps_path = pathlib.Path({json.dumps(APPS_JSON)})
slug = "typeup-win-release"
current = pathlib.Path({json.dumps(REMOTE_DIR)}) / "current"
resolved = current.resolve()
files = [p for p in resolved.rglob("*") if p.is_file()]
apps = json.loads(apps_path.read_text(encoding="utf-8"))
apps[slug] = {{
    "slug": slug,
    "deployed_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "file_count": len(files),
    "size_bytes": sum(p.stat().st_size for p in files),
    "release": resolved.name,
    "version": {json.dumps(manifest["version"])},
    "sha256": {json.dumps(manifest["sha256"])},
}}
apps_path.write_text(json.dumps(apps, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
print(json.dumps(apps[slug], ensure_ascii=False, indent=2))
PY
readlink "$ROOT/current"
ls -lh "$ROOT/current/latest.yml" "$ROOT/current/{manifest['installerName']}" "$ROOT/current/{manifest['files']['windows']['blockmapName']}" "$ROOT/current/typeup-update.json"
"""
    print(run(client, command, timeout=180))


def retry(label, callback, attempts=8, delay=2):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            return callback()
        except Exception as error:
            last_error = error
            if attempt == attempts:
                break
            print(f"{label} not ready ({error}); retry {attempt}/{attempts - 1}")
            time.sleep(delay)
    raise last_error


def request_url(url, method="GET", headers=None):
    request = urllib.request.Request(url, method=method, headers=headers or {})
    request.add_header("User-Agent", "TypeUpPublisher/1.0")
    request.add_header("Cache-Control", "no-cache")
    return urllib.request.urlopen(request, timeout=45)


def read_text_url(url):
    with request_url(url) as response:
        return response.read().decode("utf-8", "replace")


def read_json_url(url):
    return json.loads(read_text_url(url))


def head_url(url):
    with request_url(url, method="HEAD") as response:
        return response.status, response.headers


def range_probe(url):
    try:
        with request_url(url, headers={"Range": "bytes=0-1023"}) as response:
            body = response.read()
            return response.status, response.headers, len(body)
    except urllib.error.HTTPError as error:
        return error.code, error.headers, len(error.read())


def hash_public_file(url):
    digest = hashlib.sha256()
    total = 0
    with request_url(url) as response:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            digest.update(chunk)
    return total, digest.hexdigest()


def verify_public_urls(manifest, public_base_url):
    latest_url = public_url(public_base_url, "latest.yml")
    installer_url = manifest["installerUrl"]
    blockmap_url = manifest["blockmapUrl"]
    manifest_url = public_url(public_base_url, "typeup-update.json")

    def check_latest():
        latest_text = read_text_url(latest_url)
        if f"version: {manifest['version']}" not in latest_text or manifest["installerName"] not in latest_text:
            raise RuntimeError("public latest.yml is not the new release")

    def check_manifest():
        public_manifest = read_json_url(manifest_url)
        if public_manifest.get("version") != manifest["version"] or public_manifest.get("sha256") != manifest["sha256"]:
            raise RuntimeError("public typeup-update.json is not the new release")

    retry("latest.yml", check_latest)
    retry("typeup-update.json", check_manifest)

    installer_status, installer_headers = head_url(installer_url)
    if installer_status != 200:
        raise RuntimeError(f"installer HEAD returned HTTP {installer_status}")
    installer_length = int(installer_headers.get("Content-Length") or 0)
    if installer_length != manifest["installerSize"]:
        raise RuntimeError(f"installer Content-Length mismatch: expected {manifest['installerSize']}, got {installer_length}")

    blockmap_status, blockmap_headers = head_url(blockmap_url)
    if blockmap_status != 200:
        raise RuntimeError(f"blockmap HEAD returned HTTP {blockmap_status}")
    blockmap_length = int(blockmap_headers.get("Content-Length") or 0)
    expected_blockmap_length = manifest["files"]["windows"]["blockmapSize"]
    if blockmap_length != expected_blockmap_length:
        raise RuntimeError(f"blockmap Content-Length mismatch: expected {expected_blockmap_length}, got {blockmap_length}")

    range_status, _headers, body_length = range_probe(installer_url)
    if range_status != 206 or body_length == 0:
        raise RuntimeError(f"installer Range probe expected HTTP 206, got HTTP {range_status}")

    total, public_sha256 = hash_public_file(installer_url)
    if total != manifest["installerSize"] or public_sha256 != manifest["sha256"]:
        raise RuntimeError("public installer sha256 check failed")

    print("public verification ok")
    print(f"latest:    {latest_url}")
    print(f"manifest:  {manifest_url}")
    print(f"installer: {installer_url}")


def main():
    parser = argparse.ArgumentParser(description="Publish TypeUp Windows updater files atomically.")
    parser.add_argument("--repo", required=True, help="Path to the typeup-win repository.")
    parser.add_argument("--version", required=True, help="Version without v prefix, for example 0.3.10.")
    parser.add_argument("--host", default="5.tcp.cpolar.cn")
    parser.add_argument("--port", type=int, default=10281)
    parser.add_argument("--user", default="wq")
    parser.add_argument("--password-env", default="TYPEUP_SSH_PASS")
    parser.add_argument("--public-base-url", default=PUBLIC_BASE_URL)
    parser.add_argument("--alternate-url", action="append", default=[], help="Optional backup installer URL.")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    release_dir = repo / "release"
    installer, blockmap, latest, manifest_path, manifest = validate_artifacts(
        args.version,
        release_dir,
        args.public_base_url,
        args.alternate_url,
    )
    client = connect(args)
    try:
        release_name = upload_snapshot(client, (installer, blockmap, latest, manifest_path), manifest, args.version)
    finally:
        client.close()
    verify_public_urls(manifest, args.public_base_url)
    print(f"published {release_name}")


if __name__ == "__main__":
    main()
