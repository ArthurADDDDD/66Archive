#!/usr/bin/env python3
"""Read-only keyword scan of replay/original source metadata and notes."""
import argparse, csv, json, pathlib, re, sys, collections
import yaml

TERMS = ['切片', '精剪', '剪辑', '集锦', '片段', '删减', '不完整', '直播时刻', '部分录像']
RX = re.compile('|'.join(map(re.escape, TERMS)))
BVID_RX = re.compile(r'BV[0-9A-Za-z]+')
# Strip internal work-item identifiers and adjacent task/date provenance from public excerpts.
INTERNAL = re.compile(r'(?:\s*\d{4}-\d{2}-\d{2}\s*)?(?:task[-_ ]?\d+|任务\s*\d+)[^。；;]*[。；;]?|(?:\s*\d{4}-\d{2}-\d{2}\s*)?(?:逐条处置时补入|核验时补入)[^。；;]*[。；;]?', re.I)

def safe(text):
    text = str(text or '').replace('\n', ' ').strip()
    text = INTERNAL.sub('[核验记录略]', text)
    return re.sub(r'\s+', ' ', text).strip()

def load_metadata(paths):
    by_id, by_url = {}, {}
    for path in paths or []:
        with open(path, encoding='utf-8') as f:
            for line in f:
                try:
                    item = json.loads(line)
                    if item.get('id'): by_id[item['id']] = item
                    if item.get('url'): by_url[item['url']] = item.get('result', item)
                except (json.JSONDecodeError, TypeError): pass
    return by_id, by_url

def hits(text): return sorted(set(RX.findall(str(text or ''))))
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--entries',required=True)
    ap.add_argument('--metadata-jsonl',action='append',default=[])
    ap.add_argument('--csv',required=True)
    ap.add_argument('--summary',required=True)
    args=ap.parse_args()
    metadata, metadata_by_url=load_metadata(args.metadata_jsonl)
    entries=[]
    for path in sorted(pathlib.Path(args.entries).glob('*.yaml')):
        data=yaml.safe_load(path.read_text(encoding='utf-8')) or []
        if isinstance(data,list): entries.extend((e,path.name) for e in data if isinstance(e,dict))
    source_total=0; eligible=0; rows=[]; all_sources=collections.defaultdict(list)
    for entry, filename in entries:
        sources=entry.get('sources') or []
        for idx, source in enumerate(sources):
            source_total+=1
            all_sources[source.get('url','')].append((entry,source))
            if source.get('kind') not in ('replay','original'): continue
            eligible+=1
            url=str(source.get('url') or '')
            mm=BVID_RX.search(url); bvid=mm.group(0) if mm else ''
            md=metadata.get(bvid,{})
            other=metadata_by_url.get(url,{})
            cached_title=md.get('title') or other.get('page_title') or other.get('og_title') or other.get('site_title') or ''
            item_hits=[]
            for field,text in [('entry_note',entry.get('note')),('source_note',source.get('note')),('cache_title',cached_title),('cache_description',other.get('description'))]:
                hs=hits(text)
                if hs: item_hits.append((field,hs,str(text)))
            page_hit=[]
            for pg in md.get('pages') or []:
                part=str(pg.get('part') or pg.get('title') or '')
                hs=hits(part)
                if hs: page_hit.append((pg.get('page'),hs,part))
            if not item_hits and not page_hit: continue
            details=source.get('part_details') or []
            nmeta=len(md.get('pages') or [])
            parts=source.get('parts')
            same_url=all_sources[url]
            # Existing explicit notes and same-entry alternate source are mitigating context only.
            entry_source_notes=' '.join(str(s.get('note') or '') for s in sources)
            other_sources=[s for j,s in enumerate(sources) if j!=idx]
            strong_partial=bool(re.search(r'明确不是全场|仅作补充|片段间有小缺口|部分切片|不完整回放|仅含.*部分|未覆盖|缺少',str(source.get('note') or '')))
            has_alt=bool(other_sources)
            details_match=(bool(details) and (not parts or len(details)==parts))
            if strong_partial: category='source_note_already_explicitly_limited'
            elif item_hits and any(field=='source_note' for field,_,_ in item_hits): category='source_note_semantic_candidate'
            elif item_hits and any(field=='cache_title' for field,_,_ in item_hits) or page_hit: category='platform_title_semantic_candidate'
            else: category='entry_note_context_only'
            if re.search(r'这是整场|全程录像|同一剪辑版|\[无剪辑\]|无剪辑实况', str(source.get('note') or '')+str(cached_title or '')): exclusion='命中词用于描述同投稿另一版本、完整来源或明确无剪辑内容；作为已解释的语义误报排除'
            elif strong_partial and has_alt: exclusion='来源备注已说明为补充/不完整，且同条另有来源；保留为已知有界来源，不作为新漏档结论'
            elif strong_partial: exclusion='来源备注已明确限定范围/不完整；属于已知风险线索，不代表整条缺档'
            elif details_match and nmeta and parts and parts==nmeta: exclusion='source.parts、part_details与缓存页数相符；这只能证明结构一致，仍不能证明内容完整'
            elif has_alt: exclusion='同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决'
            else: exclusion='未见同条其他来源或明确补充解释；优先人工核对，但词命中本身不是缺失证据'
            termlist=sorted(set(t for _,hs,_ in item_hits for t in hs) | set(t for _,hs,_ in page_hit for t in hs))
            risk=0
            if category=='source_note_semantic_candidate': risk+=5
            if category=='platform_title_semantic_candidate': risk+=4
            if category=='entry_note_context_only': risk+=2
            if not has_alt: risk+=2
            if strong_partial: risk-=4
            if details_match: risk-=2
            # Entry-level language can apply to another source; mark it as context, not source proof.
            primary=category in ('source_note_semantic_candidate','platform_title_semantic_candidate')
            rows.append({
                'entry_id':entry.get('id',''),'entry_date':entry.get('date',''),'entry_type':entry.get('type',''),
                'entry_title':safe(entry.get('title','')),'source_index':idx,'source_kind':source.get('kind',''),
                'source_status':source.get('status',''),'source_url':url,'matched_terms':'|'.join(termlist),
                'match_fields':'|'.join(f for f,_,_ in item_hits)+('|page_title' if page_hit else ''),
                'entry_note_excerpt':safe(next((t for f,_,t in item_hits if f=='entry_note'),'')),
                'source_note_excerpt':safe(next((t for f,_,t in item_hits if f=='source_note'),'')),
                'cached_title_excerpt':safe(next((t for f,_,t in item_hits if f=='cache_title'),'')),
                'cached_description_excerpt':safe(next((t for f,_,t in item_hits if f=='cache_description'),'')),
                'cached_page_title_hits':'; '.join(f"P{p}: {safe(t)}" for p,hs,t in page_hit),
                'source_parts':parts if parts is not None else '', 'part_details_count':len(details),
                'cached_page_count':nmeta,'metadata_cached':bool(md or other),'metadata_api_duration_sec':md.get('duration',''),
                'same_entry_other_source_count':len(other_sources),'explicitly_limited_in_source_note':strong_partial,
                'part_details_count_matches_parts':details_match,'machine_bucket':category,'machine_priority':risk,
                'exclusion_or_caveat':exclusion,'machine_note_scope':'source-specific' if primary else 'entry-level context only'
            })
    rows.sort(key=lambda r:(-r['machine_priority'],r['entry_date'],r['entry_id'],r['source_index']))
    out=pathlib.Path(args.csv);out.parent.mkdir(parents=True,exist_ok=True)
    with out.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else ['entry_id']);w.writeheader();w.writerows(rows)
    bucket=collections.Counter(r['machine_bucket'] for r in rows)
    no_alt=sum(not r['same_entry_other_source_count'] for r in rows)
    no_metadata=sum(not r['metadata_cached'] for r in rows)
    summary=pathlib.Path(args.summary);summary.parent.mkdir(parents=True,exist_ok=True)
    with summary.open('w',encoding='utf-8') as f:
        f.write('# Replay/Original 备注与标题语义命中筛查\n\n')
        f.write('## 方法与范围\n\n')
        f.write(f'按当前归档快照逐条读取 `data/entries/*.yaml`：共 {len(entries)} 条记录、{source_total} 个来源引用；其中 kind 为 replay/original 的来源 {eligible} 条。对条目备注、来源备注及可用的缓存投稿标题/分P标题扫描：{", ".join(TERMS)}。本次没有网络请求，也没有按时长阈值筛选。缓存未收录的来源依然会检查档案备注。\n\n')
        f.write(f'共命中 {len(rows)} 个来源引用，涉及 {len(set(r["entry_id"] for r in rows))} 条entry。按命中位置分桶：{dict(bucket)}。其中 {no_alt} 个命中来源所在entry没有其他来源；{no_metadata} 个命中来源未在本地投稿元数据缓存中找到。命中可来自entry级备注，不能自动视为具体来源本身被剪辑。\n\n')
        f.write('页面分P数、part_details数量与缓存页数只用于识别已有结构性覆盖线索；数字相符不证明逐秒完整，数字不符也不单独证明缺段。报告中的分类和优先级是候选排序，不是人工确认或缺档结论。\n\n')
        f.write('## 最值得人工回看的候选（最多10条）\n\n')
        chosen=[r for r in rows if r['machine_bucket'] in ('source_note_semantic_candidate','platform_title_semantic_candidate') and not r['explicitly_limited_in_source_note'] and '语义误报排除' not in r['exclusion_or_caveat']]
        for i,r in enumerate(chosen[:10],1):
            f.write(f"{i}. **{r['entry_date']} {r['entry_id']}** — {r['entry_title']}；{r['source_kind']} {r['source_url']}。命中 `{r['matched_terms']}`（{r['match_fields']}）。")
            quote=r['source_note_excerpt'] or r['cached_title_excerpt'] or r['cached_page_title_hits']
            if quote: f.write(f' 原文摘录：{quote[:240]}。')
            f.write(f" 排除/核验线索：{r['exclusion_or_caveat']}；entry时长及来源结构列于CSV。\n")
        if not chosen: f.write('没有发现来源级备注或平台标题语义、且尚未被明确限定的候选。\n')
        f.write('\n## 已有解释/排除注意\n\n')
        f.write('`source_note_already_explicitly_limited` 表示来源备注已经写明局部片段、缺口或补充来源；这些仍留在完整命中CSV，供核查“现有说明是否够用”，但不重复包装为新发现。`entry_note_context_only` 只说明同场、剪辑或版本关系可能存在，不能推断该行每个source都不完整。含有完整页、双版本或同条互补来源的候选，应先按来源逐一核对，不能因短版本单独较短而判缺。正常短尾P不会只因时长短而命中。\n\n')
        f.write('## 复现\n\n')
        f.write('运行脚本需 Python 3、PyYAML；可选的平台 JSONL 元数据仅从本地缓存读取（可重复传入多个缓存文件）：\n\n```bash\npython3 docs/research/deep-source-audit-2026-10-23/kind-note-evidence-scan.py \\\n  --entries data/entries \\\n  --metadata-jsonl /path/to/bilibili-metadata.jsonl \
  --metadata-jsonl /path/to/other-metadata.jsonl \\\n  --csv docs/research/deep-source-audit-2026-10-23/kind-note-evidence-scan.csv \\\n  --summary docs/research/deep-source-audit-2026-10-23/kind-note-evidence-scan.md\n```\n\n')
        f.write('本轮仅生成审计候选；未修改正式数据、链接或条目类型。没有检查任何录像画面；缓存未覆盖的平台/来源标题、已删除内容及关键词以外的表达不在本扫描的确证范围内。\n')
    print(json.dumps({'entries':len(entries),'source_refs':source_total,'eligible_replay_original':eligible,'hits':len(rows),'entries_hit':len(set(r['entry_id'] for r in rows)),'categories':bucket,'top_candidates':len(chosen[:10]),'no_metadata':no_metadata,'csv':str(out),'summary':str(summary)},ensure_ascii=False))
if __name__=='__main__':main()
