from pathlib import Path
import csv, re, sys
import yaml

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(__file__).resolve().parent
EARLY = '2020-01-01'

entries = []
for p in sorted((ROOT / 'data/entries').glob('*.yaml')):
    loaded = yaml.safe_load(p.read_text(encoding='utf-8')) or []
    if isinstance(loaded, dict):
        loaded = loaded.get('entries', [])
    for e in loaded:
        if e.get('date', '') < EARLY and e.get('type') in ('live', 'video'):
            e['_file'] = p.relative_to(ROOT).as_posix()
            entries.append(e)

timelines = {}
for t in (yaml.safe_load((ROOT/'data/game-timelines.yaml').read_text(encoding='utf-8')) or []):
    if isinstance(t, dict) and t.get('entry'):
        timelines[t['entry']] = t

corpus = []
for base in (ROOT/'data/catalogs', ROOT/'data/reports'):
    for p in base.rglob('*'):
        if p.is_file() and p.suffix.lower() in {'.csv','.md','.yaml','.yml','.json'}:
            try: corpus.append((p.relative_to(ROOT).as_posix(), p.read_text(encoding='utf-8', errors='replace')))
            except OSError: pass

evidence_file = ROOT/'src/lib/game-footage-evidence.ts'
evidence_text = evidence_file.read_text(encoding='utf-8') if evidence_file.exists() else ''

def csvwrite(path, rows, fields):
    with path.open('w', encoding='utf-8-sig', newline='') as f:
        w=csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        w.writeheader(); w.writerows(rows)

rows=[]
for e in sorted(entries, key=lambda x: (x.get('date',''), x.get('id',''))):
    ident=e.get('id','')
    note=' '.join(str(x) for x in [e.get('note',''), *[s.get('note','') for s in e.get('sources',[])]] if x)
    low=note.lower()
    srcs=e.get('sources') or []
    tl=timelines.get(ident)
    refs=[(p,txt) for p,txt in corpus if ident and ident in txt]
    matched=' | '.join(f'{p} ({txt.count(ident)} hit)' for p,txt in refs)
    gap_match=re.search(r"\{\s*entry:\s*['\"]"+re.escape(ident)+r"['\"](?P<body>.*?)(?:\n  \},)", evidence_text, re.S)
    reviewed_gap=''
    if gap_match:
        body=gap_match.group('body')
        gs=re.search(r"games:\s*\[(.*?)\]",body,re.S)
        st=re.search(r"status:\s*['\"]([^'\"]+)",body)
        reviewed_gap='status='+ (st.group(1) if st else 'unspecified') + '; games=' + (gs.group(1).replace("'",'').replace('"','').replace('\n','').strip() if gs else 'unspecified')
    source_urls=' | '.join(dict.fromkeys(s.get('url','') for s in srcs if s.get('url')))
    source_kinds='; '.join(f"{s.get('kind','?')}:{s.get('status','?')}" for s in srcs)
    gaps=[]
    if e.get('no_public_replay'): gaps.append('no_public_replay field')
    if e.get('missing_footage'): gaps.append('missing_footage field')
    if any(s.get('status') in ('dead','unavailable','broken') for s in srcs): gaps.append('dead/unavailable source')
    if srcs and all(s.get('kind')=='clip' for s in srcs): gaps.append('clip-only source set')
    if any(k in low for k in ('缺失','缺少','未找到','录像未找到','录像暂未找到','missing_footage','only clip','片段','不完整','未覆盖','没有可用录像','未能确认可播放')):
        gaps.append('entry/source note contains limitation or evidence cue; inspect quoted context')
    if tl:
        gaps.append('timeline coverage='+str(tl.get('coverage','unspecified')))
    if e.get('duration_min') is not None and srcs:
        durations=[s.get('duration_sec') for s in srcs if isinstance(s.get('duration_sec'),(int,float))]
        if durations:
            closest=round(min(durations)/60)
            if abs(closest-e['duration_min'])>30: gaps.append(f'listed duration differs from source metadata ({e["duration_min"]}m vs nearest {closest}m); semantics require review')
    if e.get('type')=='live' and len(e.get('games') or [])>1 and not tl:
        gaps.append('multiple game labels without game timeline; source coverage per game unresolved')
    if not srcs and not e.get('no_public_replay'):
        gaps.append('no source object')
    confirmed = bool(e.get('missing_footage') or e.get('no_public_replay') or (srcs and all(s.get('kind')=='clip' for s in srcs)))
    online_override = {
      '2015-07-06-live-01': '2026-10-22 direct AcFun page request through available web tool: inaccessible; no media/content inspected.',
      '2015-07-10-live-01': '2026-10-22 direct Youku page request via read-only Python urllib: HTTP 200, page title/date/duration metadata observed (19:16; published 2015-07-14 20:36:38); no playback or media request. Current playback and six-minute segment not independently confirmed this audit.'
    }.get(ident)
    if online_override:
        status='locally_or_online_checked'
        basis='A source access/search attempt was made and failed; this status records the attempted check only. See existing evidence flags for prior findings.'
    elif confirmed:
        status='problem_confirmed_from_existing_evidence'
        basis='Explicit entry flag and/or source set proves at least a specific recording gap; not a claim that no other material exists.'
    elif not srcs:
        status='unresolved'
        basis='No playable source recorded in this entry; catalogs/reports may contain leads, not content confirmation.'
    elif tl and tl.get('coverage') in ('partial','unknown'):
        status='unresolved'
        basis='Timeline explicitly records partial/unknown coverage.'
    elif len(e.get('games') or [])>1 and not tl:
        status='unresolved'
        basis='Multiple game labels but no timeline to establish per-game source coverage.'
    elif any(s.get('status') not in ('alive',) for s in srcs):
        status='unresolved'
        basis='Source status is not wholly alive; availability/content needs checking.'
    else:
        status='metadata_only'
        basis='Metadata and existing notes/catalog references scanned; source content not comprehensively reviewed in this audit.'
    rows.append({
      'entry':ident,'date':e.get('date',''),'type':e.get('type',''),'title':str(e.get('title','')).replace('\n',' '),
      'confidence':e.get('confidence',''),'games':'|'.join(e.get('games') or []),'status':status,'audit_basis':basis,
      'coverage_basis':(f"timeline:{tl.get('coverage','?')}" if tl else ('source notes only; no timeline' if e.get('type')=='live' else 'no timeline')), 
      'duration_min':e.get('duration_min',''),'missing_footage':str(e.get('missing_footage','')),
      'no_public_replay':str(e.get('no_public_replay','')),'source_kinds_status':source_kinds,'source_urls':source_urls,
      'existing_evidence_flags':' | '.join(gaps),'existing_game_footage_review':reviewed_gap,'catalog_report_references':matched,
      'online_check':online_override or 'not checked in this audit','unverified':'full media content, completeness, opening/ending, all parts, cross-session mixing, and whether complementary sources exist unless explicitly stated otherwise'
    })

fields=list(rows[0].keys()) if rows else []
csvwrite(OUT/'early.csv',rows,fields)
counts={}
for r in rows: counts[r['status']]=counts.get(r['status'],0)+1
print(f'rows={len(rows)} status={counts}')
