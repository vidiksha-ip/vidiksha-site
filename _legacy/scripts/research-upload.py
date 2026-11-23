"""Upload the built Research data to the private Supabase Storage bucket "research".

The static site (GitHub Pages) never carries the research data; members fetch it from this bucket with their session.
Run after a LOCAL build (node build.js, without --production), which writes dist/research/.

    set SUPABASE_URL=https://<project>.supabase.co            (Windows; use export on macOS/Linux)
    set SUPABASE_SERVICE_KEY=<secret key from Project Settings -> API Keys -> Secret keys>
    python scripts/research-upload.py              # uploads new and changed files only
    python scripts/research-upload.py --all        # re-upload everything

The secret key never goes in the repo or in site.json. Uploads use it only on this machine.
"""
import hashlib, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "dist" / "research"
STATE = ROOT / ".research-upload-state.json"
BUCKET = "research"


def main():
    url = os.environ.get("SUPABASE_URL") or json.loads((ROOT / "content" / "site.json").read_text(encoding="utf-8"))["supabase"]["url"]
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        sys.exit("Set SUPABASE_SERVICE_KEY to the project's secret key (never the publishable one) and re-run.")
    if not (SRC / "data" / "manifest.json").exists():
        sys.exit("dist/research/ is missing. Run `node build.js` (a local build, without --production) first.")
    url = url.rstrip("/")
    force = "--all" in sys.argv
    state = {} if force or not STATE.exists() else json.loads(STATE.read_text(encoding="utf-8"))

    files = [p for p in SRC.rglob("*") if p.is_file() and p.suffix == ".json"]
    todo = []
    for p in files:
        rel = p.relative_to(SRC).as_posix()
        digest = hashlib.md5(p.read_bytes()).hexdigest()
        if state.get(rel) != digest:
            todo.append((p, rel, digest))
    print(f"{len(files)} files in dist/research, {len(todo)} to upload")

    def put(item):
        p, rel, digest = item
        body = p.read_bytes()
        req = urllib.request.Request(f"{url}/storage/v1/object/{BUCKET}/{rel}", data=body, method="POST", headers={
            "Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json",
            "x-upsert": "true", "cache-control": "max-age=86400",
        })
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    r.read()
                return rel, digest, None
            except urllib.error.HTTPError as e:
                msg = e.read().decode("utf-8", "ignore")[:200]
                if e.code in (401, 403):
                    return rel, None, f"{e.code}: {msg} (is the key the secret key, and does the bucket exist? run migration 0003)"
                if attempt == 3:
                    return rel, None, f"{e.code}: {msg}"
            except Exception as e:  # noqa: BLE001
                if attempt == 3:
                    return rel, None, str(e)
            time.sleep(1 + attempt)

    t0, done, failed = time.time(), 0, []
    with ThreadPoolExecutor(max_workers=12) as ex:
        for rel, digest, err in ex.map(put, todo):
            if err:
                failed.append((rel, err))
                if len(failed) <= 5:
                    print(f"  ! {rel}: {err}")
            else:
                state[rel] = digest
            done += 1
            if done % 1000 == 0:
                print(f"  {done}/{len(todo)} uploaded, {time.time() - t0:.0f}s")
                STATE.write_text(json.dumps(state), encoding="utf-8")
    STATE.write_text(json.dumps(state), encoding="utf-8")
    print(f"done: {done - len(failed)} uploaded, {len(failed)} failed, {time.time() - t0:.0f}s")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
