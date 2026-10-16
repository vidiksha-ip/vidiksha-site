"""Resolve each indexed judgment to its official PDF on the AWS Open Data Registry (Dattam Labs mirrors of the
eCourts and Supreme Court portals, CC BY 4.0). Writes content/research/links.json ({case_id: url}).

High Courts: the bucket stores PDFs as data/pdf/year=YYYY/court=<code>/bench=<bench>/<CNR>_<order>_<date>.pdf, so each
judgment is found by listing its CNR prefix (one small unsigned S3 request per judgment).
Supreme Court: per-year metadata parquet files map our case id (the neutral citation, e.g. 1997_INSC_701) to the file path.

Usage:  python scripts/research-links.py            # resolve everything not yet in links.json
        python scripts/research-links.py --force    # re-resolve all
"""
import json, re, sys, time, urllib.request, urllib.parse  # no sibling imports; runs under python -I as well
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from xml.etree import ElementTree

HC = "https://indian-high-court-judgments.s3.ap-south-1.amazonaws.com/"
SC = "https://indian-supreme-court-judgments.s3.ap-south-1.amazonaws.com/"
CONTENT = Path(__file__).resolve().parent.parent / "content" / "research"
OUT = CONTENT / "links.json"
NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"


def s3_keys(base, prefix):
    url = f"{base}?list-type=2&max-keys=20&prefix={urllib.parse.quote(prefix, safe='')}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                tree = ElementTree.fromstring(r.read())
            return [k.text for k in tree.iter(f"{NS}Key")]
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                return None
            time.sleep(1 + attempt)


def resolve_hc(c):
    cnr, code, bench = c["case_id"], c.get("court_code") or "", c.get("bench") or ""
    date = (c.get("decision_date") or "")[:10]
    if not (cnr and code and bench):
        return None
    years = []
    if date[:4].isdigit():
        years.append(date[:4])
    if cnr[-4:].isdigit() and cnr[-4:] not in years:
        years.append(cnr[-4:])
    if date[:4].isdigit():
        for d in (1, -1):
            y = str(int(date[:4]) + d)
            if y not in years:
                years.append(y)
    for y in years:
        keys = s3_keys(HC, f"data/pdf/year={y}/court={code}/bench={bench}/{cnr}_")
        if keys:
            pdfs = [k for k in keys if k.endswith(".pdf")]
            if not pdfs:
                continue
            # A CNR can carry several orders; take the one dated closest to our decision date.
            def distance(k):
                m = re.search(r"_(\d{4}-\d{2}-\d{2})\.pdf$", k)
                if not (m and date):
                    return 10**9
                a, b = m.group(1).split("-"), date.split("-")
                return abs((int(a[0]) - int(b[0])) * 372 + (int(a[1]) - int(b[1])) * 31 + (int(a[2]) - int(b[2])))
            key = min(pdfs, key=distance)
            return HC + urllib.parse.quote(key)
    return None


def resolve_sc(cases):
    import duckdb
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    out = {}
    by_year = {}
    for c in cases:
        y = str(c.get("year") or (c.get("decision_date") or "")[:4] or c["case_id"][:4])
        by_year.setdefault(y, []).append(c)
    for y, cs in sorted(by_year.items()):
        url = f"{SC}metadata/parquet/year={y}/metadata.parquet"
        try:
            rows = con.execute(f"SELECT case_id, nc_display, path, citation FROM read_parquet('{url}')").fetchall()
        except Exception as e:  # noqa: BLE001
            print(f"  SC {y}: metadata unavailable ({str(e)[:60]})")
            continue
        norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())
        by_id = {}
        for case_id, nc, path, cit in rows:
            for key in (case_id, nc, cit):
                if key:
                    by_id.setdefault(norm(key), path)
        for c in cs:
            path = by_id.get(norm(c["case_id"])) or by_id.get(norm(c.get("citation")))
            if path:
                if not path.startswith("data/"):
                    path = f"data/pdf/year={y}/english/{path}"
                out[c["case_id"]] = SC + urllib.parse.quote(path)
        print(f"  SC {y}: {sum(1 for c in cs if c['case_id'] in out)}/{len(cs)} resolved")
    return out


def main():
    force = "--force" in sys.argv
    links = {} if force or not OUT.exists() else json.loads(OUT.read_text(encoding="utf-8"))
    hc, sc = [], []
    for f in sorted(CONTENT.glob("*.json")):
        if f.name in ("links.json", "issues.json"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        for c in d["cases"]:
            if c["case_id"] in links:
                continue
            (sc if d["court"] == "supreme-court" else hc).append(c)
    print(f"to resolve: {len(hc)} High Court, {len(sc)} Supreme Court")
    t0 = time.time()
    if sc:
        links.update(resolve_sc(sc))
    done = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for c, url in zip(hc, ex.map(resolve_hc, hc)):
            done += 1
            if url:
                links[c["case_id"]] = url
            if done % 500 == 0:
                print(f"  {done}/{len(hc)} High Court judgments checked, {time.time() - t0:.0f}s")
                OUT.write_text(json.dumps(links), encoding="utf-8")
    OUT.write_text(json.dumps(links), encoding="utf-8")
    total = len(hc) + len(sc)
    print(f"resolved {sum(1 for c in hc + sc if c['case_id'] in links)}/{total} new, {len(links)} links in total, {time.time() - t0:.0f}s -> {OUT}")


if __name__ == "__main__":
    main()
