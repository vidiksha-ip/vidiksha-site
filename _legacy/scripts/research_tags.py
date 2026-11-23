"""Text-derived facets for the Research page: legal issues, industries and statutes cited.
Pure regex over the lowercased full text of a judgment. Each entry is (pattern, minimum hits).
Shared by scripts/research-index.py (mirror build) and any local export. No AI anywhere."""
import re

ISSUES = {
    "Interim injunction": (r"interim injunction|ad[\s-]interim|interlocutory injunction|order (xxxix|39) rules? ?[12]|temporary injunction", 2),
    "Passing off": (r"passing[\s-]off", 2),
    "Deceptive similarity": (r"deceptive(ly)? similar|likelihood of confusion|confusingly similar|phonetic(ally)? similar", 2),
    "Well-known mark and dilution": (r"well[\s-]known (trade )?mark|dilution|trans[\s-]?border reputation|section 11\(6\)", 1),
    "Rectification and cancellation": (r"rectification|cancellation of (the )?(registration|trade mark|mark|design|patent)|section 57 of the trade marks|section 47 of the trade marks|removal of (the )?(trade )?mark", 2),
    "Opposition": (r"notice of opposition|opposition proceedings?|\bopponent", 2),
    "Registrability and descriptiveness": (r"section 9 of the trade marks|section 9\(1\)|descriptive|devoid of (any )?distinctive|distinctiveness|acquired distinctiveness|secondary meaning|laudatory", 2),
    "Relative grounds and prior marks": (r"section 11 of the trade marks|section 11\(1\)|earlier (trade )?mark|cited mark|prior registration|section 12 of the trade marks", 2),
    "Non-use": (r"non[\s-]use|not been used|bona fide use|section 47", 2),
    "Patent validity: novelty and inventive step": (r"inventive step|novelty|prior art|obvious(ness)?|anticipat(ed|ion)|person skilled in the art|section 2\(1\)\(ja\)", 2),
    "Patent subject matter: Section 3": (r"section 3\(d\)|section 3\(k\)|section 3\(i\)|section 3\(j\)|3\(d\) of the patents|3\(k\) of the patents|computer programme per se|new form of a known substance|enhanced (therapeutic )?efficacy", 1),
    "Pre-grant and post-grant opposition": (r"pre[\s-]grant|post[\s-]grant|section 25\(", 1),
    "Compulsory licence and working": (r"compulsory licen[cs]e|section 84 of the patents|working of (the )?patent|form 27", 1),
    "Claim construction and infringement (patents)": (r"claim construction|doctrine of equivalents|pith and marrow|essential features of the claim|infringement of (the )?patent|patent infringement", 1),
    "Copyright infringement": (r"infringement of copyright|copyright infringement|section 51 of the copyright|substantial (copying|reproduction|part)|idea[\s-]expression", 1),
    "Fair dealing and exceptions": (r"fair dealing|fair use|section 52 of the copyright|section 52\(1\)", 1),
    "Ownership, authorship and assignment": (r"first owner|section 17 of the copyright|work made for hire|contract of service|assignment of (the )?(copyright|trade mark|patent|mark)|assignment deed|section 18 of the copyright|section 19 of the copyright", 2),
    "Licensing, franchise and royalties": (r"licen[cs]e agreement|licen[cs]ee|franchis|royalt|permitted use|registered user", 2),
    "Criminal IP offences": (r"section 63 of the copyright|section 103 of the trade marks|section 104 of the trade marks|section 64 of the copyright|first information report|\bfir\b|counterfeit|seizure", 2),
    "Design piracy and registrability": (r"piracy of (a |the )?(registered )?design|section 22 of the designs|section 19 of the designs|registered design|prior publication", 2),
    "Geographical indications": (r"geographical indication", 1),
    "Domain names and online infringement": (r"domain name|cybersquatt|e[\s-]commerce|online marketplace|intermediar(y|ies)|take[\s-]down notice|dynamic injunction|rogue website|social media|instagram|facebook|youtube|amazon|flipkart|meesho|whatsapp|telegram|app store|play store", 2),
    "Comparative advertising and disparagement": (r"disparag|comparative advertis|generic disparagement|puffery", 1),
    "Trade dress and packaging": (r"trade dress|get[\s-]up|packaging|colour scheme|colour combination|shape of the (bottle|product|goods)", 3),
    "Jurisdiction and forum": (r"territorial jurisdiction|section 134 of the trade marks|section 62 of the copyright|section 20 of the code|cause of action|commercial courts? act|order (vii|7) rule 1[01]|forum non conveniens|pecuniary jurisdiction", 2),
    "Delay, acquiescence and concurrent use": (r"acquiescence|delay and laches|\blaches\b|honest(ly)? (and )?concurrent|concurrent use|section 33 of the trade marks", 1),
    "Groundless threats": (r"groundless threat|section 142 of the trade marks|section 106 of the patents", 1),
    "Anton Piller, John Doe and commissioners": (r"anton piller|john doe|ashok kumar order|local commissioner|court commissioner", 1),
    "Damages, accounts and costs": (r"\bdamages\b|rendition of accounts|punitive|exemplary|actual costs|section 35 of the code", 3),
    "Customs and border measures": (r"customs act|intellectual property rights \(imported goods\)|border measure|customs authorit", 1),
    "Personality and publicity rights": (r"personality right|publicity right|right of publicity|celebrity|likeness|persona\b", 1),
    "Software and computer programmes": (r"software|computer program|source code|object code|algorithm|mobile application", 3),
    "Pharmaceutical marks and patents": (r"pharmaceutical|schedule h|drugs and cosmetics|active pharmaceutical|generic (drug|medicine|version)|molecule", 3),
    "Plant varieties and biotechnology": (r"plant varieties|biological material|biotechnolog|microorganism|\bdna\b|gene sequence|section 3\(j\)", 2),
    "Arbitrability of IP disputes": (r"arbitra(ble|bility)|arbitration and conciliation act|section 8 of the arbitration|arbitral tribunal", 2),
}

INDUSTRIES = {
    # Thresholds are deliberately high: a judgment is tagged with an industry only when it talks about that trade repeatedly.
    "Pharmaceuticals and healthcare": (r"pharmaceutical|medicinal preparation|\btablets?\b|capsules?\b|ayurved|hospital|healthcare|diagnostic|vaccine|therapeutic|formulation|molecule|dosage", 6),
    "Food and beverages": (r"food products?|beverage|restaurant|snacks?\b|biscuits?\b|confectioner|\btea\b|coffee|spices?\b|dairy|\bmilk\b|liquor|whisky|whiskey|\bbeer\b|\bwine\b|mineral water|namkeen|sweets|ghee|edible oil|bakery|rice\b|atta\b|masala", 6),
    "Apparel, textiles and fashion": (r"apparel|garments?\b|textiles?\b|fabrics?\b|footwear|\bshoes?\b|sarees?\b|\bsari\b|fashion|jewell?ery|hosiery|denim|readymade|clothing", 6),
    "Software, internet and electronics": (r"software|mobile phones?|smartphones?|electronic goods|semiconductor|telecom|computer programme|computer software|mobile application|\bapps?\b|source code|hardware|laptop|television sets?", 6),
    "Media, film, music and publishing": (r"\bfilms?\b|cinematograph|cinema|movies?\b|\bsongs?\b|music|broadcast|television channel|\bott\b|web series|lyrics|sound recording|\bbooks?\b|publishers?\b|publishing|newspaper|magazine|literary work", 6),
    "FMCG, cosmetics and personal care": (r"cosmetics?\b|shampoo|\bsoaps?\b|detergent|toothpaste|hair oil|perfume|deodorant|skin ?care|lotion|talcum|fairness cream|toiletries", 4),
    "Automotive and engineering": (r"automobiles?\b|automotive|vehicles?\b|motorcycles?\b|scooters?\b|tractors?\b|bearings?\b|machinery|spare parts|tyres?\b|auto parts|two[\s-]wheeler|four[\s-]wheeler", 6),
    "Education and coaching": (r"university|\bschools?\b|coaching (centre|institute|classes)|educational (institution|services)|course material|textbooks?\b|e[\s-]learning|tuition|curriculum", 6),
    "Hospitality, travel and real estate": (r"\bhotels?\b|resorts?\b|hospitality|real estate|residential project|housing project|airline|travel agency|tour operator|restaurant chain", 5),
    "Agriculture, seeds and agrochemicals": (r"\bseeds?\b|fertili[sz]ers?\b|pesticides?\b|insecticides?\b|agricultur|agrochemical|crop protection|hybrid variety", 5),
    "Chemicals, paints and industrial goods": (r"chemicals?\b|paints?\b|adhesives?\b|polymers?\b|lubricants?\b|electrical goods|cables? and wires|welding|industrial (goods|products|equipment)|cement\b|steel products", 6),
    "Banking, finance and insurance": (r"banking services|insurance (company|services|policy)|financial services|mutual funds?\b|\bnbfc\b|stock broking|fintech|payment gateway|credit cards?\b", 4),
    "Tobacco and pan masala": (r"tobacco|cigarettes?\b|gutkha|pan masala|\bbidi|beedi|zarda", 3),
    "Sports, games and toys": (r"cricket|football|sporting goods|sports goods|\btoys?\b|video games?\b|fantasy sports|\bipl\b|board games?\b|playing cards", 4),
    "Retail and consumer durables": (r"retail (store|outlet|chain)|supermarket|showroom|home appliances?\b|furniture|kitchenware|utensils?\b|ceiling fans?\b|mixer grinder|pressure cooker|water purifier|air conditioner", 4),
}

STATUTES = {
    "Trade Marks Act, 1999": r"trade marks act,? 1999|trade marks act|trademarks act",
    "Trade and Merchandise Marks Act, 1958": r"trade and merchandise marks act",
    "Patents Act, 1970": r"patents act",
    "Copyright Act, 1957": r"copyright act",
    "Designs Act, 2000": r"designs act|design act, 2000",
    "Geographical Indications Act, 1999": r"geographical indications of goods",
    "Commercial Courts Act, 2015": r"commercial courts act",
    "Code of Civil Procedure, 1908": r"civil procedure code|code of civil procedure|\bcpc\b",
    "Specific Relief Act, 1963": r"specific relief act",
    "Indian Contract Act, 1872": r"contract act",
    "Information Technology Act, 2000": r"information technology act",
    "Drugs and Cosmetics Act, 1940": r"drugs and cosmetics act",
    "Customs Act and IPR (Imported Goods) Rules": r"customs act|intellectual property rights \(imported goods\)",
    "Competition Act, 2002": r"competition act",
    "Consumer Protection Act": r"consumer protection act",
    "Indian Penal Code / Bharatiya Nyaya Sanhita": r"indian penal code|\bipc\b|bharatiya nyaya sanhita",
    "Arbitration and Conciliation Act, 1996": r"arbitration and conciliation act",
    "Companies Act": r"companies act",
    "Constitution of India": r"article 226|article 227|article 32|article 19\(1\)|constitution of india",
}

def write_patterns(path):
    """Dump the issue patterns for the browser, which scores paragraphs against the selected issue filters.
    Python's (?i) prefix is dropped; the browser compiles each with the 'i' flag. The patterns use only syntax JS shares."""
    import json
    data = {name: rx.replace("(?i)", "") for name, (rx, _) in ISSUES.items()}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


_COMPILED = None


def _compiled():
    global _COMPILED
    if _COMPILED is None:
        _COMPILED = (
            [(name, re.compile(rx), n) for name, (rx, n) in ISSUES.items()],
            [(name, re.compile(rx), n) for name, (rx, n) in INDUSTRIES.items()],
            [(name, re.compile(rx)) for name, rx in STATUTES.items()],
        )
    return _COMPILED


def tag(text):
    """Return {"issues": [...], "industries": [...], "statutes": [...]} for one judgment's full lowercased text."""
    issues, industries, statutes = _compiled()
    t = text.lower()
    out = {"issues": [], "industries": [], "statutes": []}
    for name, rx, n in issues:
        if len(rx.findall(t)) >= n:
            out["issues"].append(name)
    for name, rx, n in industries:
        if len(rx.findall(t)) >= n:
            out["industries"].append(name)
    for name, rx in statutes:
        if rx.search(t):
            out["statutes"].append(name)
    return out
