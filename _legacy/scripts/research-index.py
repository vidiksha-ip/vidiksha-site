"""Build the IP case-law index for the Research page from Open India Law (Vaquill AI, CC BY 4.0).

Reads judgment parquet files straight from the public mirror with DuckDB (HTTP range requests,
nothing is downloaded to disk), keeps only judgments whose text engages an Indian IP statute,
and writes one JSON file per court to content/research/.

Usage:
    pip install duckdb
    python scripts/research-index.py supreme-court delhi bombay madras calcutta karnataka
    python scripts/research-index.py --all            # every court in the corpus (slow: ~27 GB of text scanned)

Re-run for a court to refresh it. Then `python scripts/research-links.py` resolves the official PDF links and
`npm run build` shards the result by year into dist/research/data/.
"""
import duckdb, json, sys, time, re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # research_tags and research_text live beside this script

BASE = "https://oss-data-in.vaquill.ai/v2026.08.1/"
OUT = Path(__file__).resolve().parent.parent / "content" / "research"
ALL_COURTS = ["supreme-court", "delhi", "bombay", "madras", "calcutta", "karnataka", "gujarat", "telangana",
              "andhra-pradesh", "kerala", "allahabad", "punjab-and-haryana", "rajasthan", "madhya-pradesh",
              "chhattisgarh", "orissa", "patna", "jharkhand", "gauhati", "himachal-pradesh", "uttarakhand",
              "jammu-and-kashmir", "tripura", "manipur", "meghalaya", "sikkim"]

# A judgment is "IP" when ANY chunk of it mentions one of these markers. Statute- and doctrine-led on purpose:
# bare words like "infringement" also mean constitutional rights, so they never appear alone.
IP_MARKERS = [
    "trade marks act", "trade mark act", "trademarks act", "trade and merchandise marks",
    "patents act", "copyright act", "designs act", "design act, 2000",
    "geographical indications of goods", "protection of plant varieties", "semiconductor integrated circuits layout",
    "passing off", "trade ?mark infringement", "infringement of trade ?marks?",
    "infringement of copyright", "copyright infringement", "patent infringement", "infringement of (the )?patent", "design infringement",
    "registrar of trade ?marks", "controller (general )?of patents", "trade ?marks registry", "intellectual property appellate board",
    "deceptive(ly)? similar", "well[ -]known trade ?mark", "prior user", "anton piller", "john doe order", "ashok kumar order",
]
MARKER_RE = "(" + "|".join(IP_MARKERS) + ")"
AREAS = {
    "Trademark": r"(?i)trade\s?marks?\s+act|trade\s+and\s+merchandise\s+marks|registrar\s+of\s+trade\s?marks|\bpassing[\s-]off\b|trade\s?marks?\s+registry|deceptive(ly)?\s+similar|well[\s-]known\s+trade\s?mark",
    "Patent": r"(?i)patents?\s+act|controller\s+(general\s+)?of\s+patents|\bpatentee\b|patent\s+infringement|infringement\s+of\s+(the\s+)?patent",
    "Copyright": r"(?i)copyright\s+act|copyright\s+board|registrar\s+of\s+copyrights?|infringement\s+of\s+copyright|copyright\s+infringement",
    "Design": r"(?i)designs?\s+act|registered\s+design|controller\s+of\s+designs|design\s+infringement",
    "Geographical Indication": r"(?i)geographical\s+indications?",
}
# Registry numbers of the High Courts' IP Divisions and IP appeal categories: always IP.
IPD_RE = r"(?i)\bIPD|\bCOMIP\b|\bCOMMIP\b|\bIPA/|\bIPS/|/TM/|/PT/|/CR/|/GI/|OP\(TM\)|OP\(PT\)|CMA\(PT\)|TMA/|PTA/|C\.A\.\(COMM\.IPD|C\.O\.\(COMM\.IPD|RFA\(COMM\.IPD"


def build(court: str, con) -> int:
    url = f"{BASE}in_{court}_judgments.parquet"
    area_cols = ",\n".join(
        f"  max(len(regexp_extract_all(text_original, $a{i}))) AS area_{i}" for i, _ in enumerate(AREAS)
    )
    sql = f"""
    SELECT case_id,
      any_value(title) AS title, any_value(petitioner) AS petitioner, any_value(respondent) AS respondent,
      any_value(court) AS court, any_value(court_code) AS court_code, any_value(bench) AS bench, any_value(case_number) AS case_number,
      any_value(citation) AS citation, any_value(decision_date) AS decision_date, any_value(year) AS year,
      any_value(judges) AS judges, any_value(disposition) AS disposition, any_value(description) AS description,
      any_value(source_url) AS source_url, any_value(total_chunks) AS total_chunks,
      sum(CASE WHEN regexp_matches(lower(text), $markers) THEN 1 ELSE 0 END) AS statute_hits,
      sum(CASE WHEN regexp_matches(lower(text), $markers) THEN 1 ELSE 0 END) AS term_hits,
      arg_max(left(text_original, 600), section_priority) AS key_passage,
      {area_cols}
    FROM read_parquet('{url}')
    WHERE coalesce(upper(language_code), 'EN') IN ('EN', '')
    GROUP BY case_id
    HAVING statute_hits > 0
        OR regexp_matches(coalesce(title, '') || ' ' || coalesce(case_number, ''), $ipd)
    """
    params = {"markers": MARKER_RE, "ipd": IPD_RE}
    for i, (_, rx) in enumerate(AREAS.items()):
        params[f"a{i}"] = rx
    t0 = time.time()
    rows = None
    for attempt in range(4):  # multi-GB streams over HTTP drop now and then; a retry restarts only this court
        try:
            rows = con.execute(sql, params).fetchall()
            break
        except duckdb.Error as e:
            if attempt == 3:
                raise
            print(f"{court}: {str(e)[:80]} - retrying in {30 * (attempt + 1)}s")
            time.sleep(30 * (attempt + 1))
    cols = [d[0] for d in con.description]
    cases = []
    for r in rows:
        rec = dict(zip(cols, r))
        areas = [name for i, name in enumerate(AREAS) if rec.pop(f"area_{i}") > 0]
        rec["areas"] = areas or ["Trademark"]  # matched a generic marker only (prior user, Anton Piller…); trademark is the default docket
        rec["key_passage"] = re.sub(r"\s+", " ", (rec.get("key_passage") or "")).strip()
        rec["description"] = re.sub(r"\s+", " ", (rec.get("description") or "")).strip()
        rec["judges"] = list(rec.get("judges") or [])
        for k in ("statute_hits", "term_hits"):
            rec[k] = int(rec[k])
        cases.append(rec)
    cases.sort(key=lambda c: (c.get("decision_date") or "", c["case_id"]), reverse=True)
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"{court}: {len(cases)} IP judgments selected in {time.time() - t0:.0f}s")
    tags = write_tokens(court, url, [c["case_id"] for c in cases], con)
    for c in cases:
        c.update(tags.get(c["case_id"], {"issues": [], "industries": [], "statutes": []}))
    out = OUT / f"{court}.json"
    out.write_text(json.dumps({"court": court, "source": url, "generated": time.strftime("%Y-%m-%d"), "cases": cases}, ensure_ascii=False), encoding="utf-8")
    print(f"{court}: written -> {out.relative_to(OUT.parent.parent)}")
    from research_tags import write_patterns
    write_patterns(OUT / "issues.json")
    return len(cases)


def write_tokens(court, url, case_ids, con):
    """Stream the full text of the selected judgments once. Writes the full-text tokens (<court>.tokens.jsonl.gz) and
    the paragraphs for the reader (<court>.text.jsonl.gz), and returns the text-derived facet tags."""
    import gzip
    from research_tags import tag
    from research_text import tokens, paragraphs, is_english
    tags = {}
    t0 = time.time()
    con.execute("CREATE OR REPLACE TEMP TABLE wanted AS SELECT unnest($ids) AS case_id", {"ids": case_ids})
    cur = con.execute(f"""
        SELECT case_id, page_start, text_original FROM read_parquet('{url}')
        WHERE case_id IN (SELECT case_id FROM wanted) AND coalesce(upper(language_code), 'EN') IN ('EN', '')
        ORDER BY case_id, chunk_index""")
    n = 0
    with gzip.open(OUT / f"{court}.tokens.jsonl.gz", "wt", encoding="utf-8") as tw, gzip.open(OUT / f"{court}.text.jsonl.gz", "wt", encoding="utf-8") as xw:
        cur_id, chunks = None, []
        def flush():
            nonlocal n
            if cur_id:
                paras = paragraphs(chunks)
                full = "\n".join(p[2] for p in paras)
                tw.write(json.dumps([cur_id, tokens(full)]) + "\n")
                xw.write(json.dumps([cur_id, paras], ensure_ascii=False) + "\n")
                tags[cur_id] = tag(full)
                n += 1
        while True:
            rows = cur.fetchmany(2000)
            if not rows:
                break
            for case_id, page, text in rows:
                if case_id != cur_id:
                    flush(); cur_id, chunks = case_id, []
                if is_english(text):
                    chunks.append((page or 0, text or ""))
        flush()
    print(f"{court}: full-text tokens, tags and paragraphs for {n} judgments in {time.time() - t0:.0f}s")
    return tags


def main():
    courts = sys.argv[1:]
    if courts == ["--all"]:
        courts = ALL_COURTS
    if not courts:
        print(__doc__)
        sys.exit(1)
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; SET threads TO 8;")
    total = 0
    for c in courts:
        total += build(c, con)
    print(f"total: {total}")


if __name__ == "__main__":
    main()
