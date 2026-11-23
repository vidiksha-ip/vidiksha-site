"""Text helpers shared by the index script: the full-text tokeniser and the paragraph splitter.
The tokeniser is mirrored in src/scripts/research.js (query side); keep the two identical."""
import re

STOP = set("the of and to in a is that for by or as be it this with on any not are was which from has have under at an were been shall such other than may his their its also would will if no so all into can only there he but these".split())


def tokens(text):
    t = text.lower()
    t = re.sub(r"\((\w{1,3})\)", r"_\1", t)                 # 9(1)(b) -> 9_1_b, 3(d) -> 3_d
    t = re.sub(r"\bsections?\s+(?=[0-9])", "section_", t)  # section 29 -> section_29
    out = set()
    for tok in re.split(r"[^a-z0-9_]+", t):
        tok = tok.strip("_")
        if len(tok) < 2 or len(tok) > 40 or (tok.isdigit() and len(tok) > 4):
            continue
        if "_" in tok:
            parts = tok.split("_")
            for k in range(1, len(parts) + 1):
                out.add("_".join(parts[:k]))
            if parts[0] == "section":
                for k in range(2, len(parts) + 1):
                    out.add("_".join(parts[1:k]))
        else:
            out.add(tok)
    return [x for x in out if x not in STOP]


PARA_NUM = re.compile(r"^\s*\(?(\d{1,3})[.)]\s*(?=[A-Z“\"(])")  # "20. Thus", "20.Thus", "(4) The"
_NON_LATIN = re.compile(r"[ऀ-෿฀-๿ༀ-࿿က-႟؀-ۿ]")


def is_english(text):
    """The Supreme Court corpus stores translations under the same case id; keep only chunks that are mostly Latin script."""
    if not text:
        return False
    sample = text[:2000]
    return len(_NON_LATIN.findall(sample)) < 0.05 * len(sample)


def paragraphs(chunks):
    """chunks: ordered [(page_start, text)] for one judgment, as the corpus stores them (4,096-char windows with a
    512-char overlap). Returns [[page, paragraph_number_or_0, text], ...] with the overlaps removed."""
    acc = ""
    marks = []  # (offset into acc, page)
    for page, text in chunks:
        if not is_english(text):
            continue
        text = text.replace("\r\n", "\n")
        if acc and text:
            probe = text[:80]
            tail_start = max(0, len(acc) - 1400)
            pos = acc.find(probe, tail_start) if len(probe) >= 30 else -1
            if pos != -1:
                acc = acc[:pos]
        marks.append((len(acc), page))
        acc += ("\n" if acc and not acc.endswith("\n") else "") + text
    # Split into paragraphs on blank lines, and additionally where a line starts with a paragraph number.
    out = []
    pos = 0
    for block in re.split(r"\n\s*\n", acc):
        start = acc.find(block, pos) if block else pos
        if start == -1:
            start = pos
        pos = start + len(block)
        pieces = re.split(r"\n(?=\s*\(?\d{1,3}[.)]\s+[A-Z])", block)
        off = start
        for piece in pieces:
            raw = piece
            piece = re.sub(r"[ \t]+", " ", piece).strip()
            if len(piece) >= 25:
                page = 0
                for m_off, m_page in marks:
                    if m_off <= off:
                        page = m_page
                    else:
                        break
                m = PARA_NUM.match(piece)
                num = int(m.group(1)) if m else 0
                piece = re.sub(r"\s*\n\s*", " ", piece)
                out.append([page, num, piece])
            off += len(raw) + 1
    return out
