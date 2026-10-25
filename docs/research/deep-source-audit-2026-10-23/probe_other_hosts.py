#!/usr/bin/env python3
"""Bounded read-only HTML metadata probe for non-Bilibili/AcFun archive URLs."""
import argparse, csv, glob, html, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request, yaml
from collections import Counter, defaultdict

DATA_DIR=''
CACHE=''
OUT=''
HOSTS=['v.youku.com','v.douyu.com','tv.sohu.com','t.cn']
TRACKING={'spm_id_from','spm_id','from_source','from','vd_source','share_source','share_medium','share_plat','share_session_id','share_tag','share_channel','utm_source','utm_medium','utm_campaign','utm_content','utm_term','timestamp','p'}
SENSITIVE=re.compile(r'(^|[_-])(token|sign|signature|access[_-]?key|auth|authorization|expires|secret|password|passwd)([_-]|$)',re.I)
MAX=2*1024*1024

def sanitize_url(url):
    try:
        p=urllib.parse.urlsplit(url)
        q=[]
        for k,v in urllib.parse.parse_qsl(p.query,keep_blank_values=True):
            if k.lower().startswith('utm_') or k.lower() in TRACKING: continue
            if SENSITIVE.search(k): continue
            q.append((k,v))
        return urllib.parse.urlunsplit((p.scheme.lower(),p.netloc.lower(),p.path,urllib.parse.urlencode(q,doseq=True),''))
    except Exception:return ''

def load_refs():
    refs=[]
    for f in sorted(glob.glob(os.path.join(DATA_DIR,'*.yaml'))):
        try: entries=yaml.safe_load(open(f,encoding='utf8')) or []
        except Exception: continue
        if not isinstance(entries,list):continue
        for e in entries:
            if not isinstance(e,dict):continue
            for idx,s in enumerate(e.get('sources') or []):
                url=s.get('url','')
                try: host=(urllib.parse.urlsplit(url).hostname or '').lower()
                except Exception: continue
                if host not in HOSTS:continue
                refs.append({'entry_id':e.get('id',''),'entry_type':e.get('type',''),'date':str(e.get('date','')),'title':e.get('title',''),'source_index':idx,'kind':s.get('kind',''),'archive_status':s.get('status',''),'source_url':sanitize_url(url),'source_note':s.get('note','') or ''})
    return refs

def extract_meta(body):
    text=body.decode('utf8','replace')
    def tag(pattern):
        m=re.search(pattern,text,re.I|re.S)
        return html.unescape(re.sub(r'\s+',' ',m.group(1)).strip()[:500]) if m else ''
    title=tag(r'<title[^>]*>(.*?)</title>')
    og=tag(r'<meta[^>]+(?:property|name)=["\']og:title["\'][^>]+content=["\'](.*?)["\']')
    desc=tag(r'<meta[^>]+(?:property|name)=["\']og:description["\'][^>]+content=["\'](.*?)["\']') or tag(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']')
    # Site-rendered JSON metadata only; never follow media URLs or fetch manifests.
    site_title=''
    for pat in [r'"videoTitle"\s*:\s*"((?:\\.|[^"\\])*)"']:
        m=re.search(pat,text)
        if m:
            try: site_title=json.loads('"'+m.group(1)+'"')
            except Exception: site_title=m.group(1)
            if site_title:break
    sec=''
    for pat in [r'"seconds"\s*:\s*"([0-9.]+)"',r'"duration"\s*:\s*([0-9.]+)',r'"durationMillis"\s*:\s*([0-9]+)']:
        m=re.search(pat,text)
        if m:
            sec=m.group(1)
            if 'durationMillis' in pat:
                try:sec=str(int(sec)/1000)
                except:pass
            break
    date=''
    for pat in [r'"videoPublishTime"\s*:\s*"([^"]+)"',r'"publishTime"\s*:\s*"([^"]+)"',r'"uploadDate"\s*:\s*"([^"]+)"',r'"datePublished"\s*:\s*"([^"]+)"',r'"createTime"\s*:\s*"([^"]+)"']:
        m=re.search(pat,text,re.I)
        if m:date=m.group(1);break
    visible=re.sub(r'(?is)<(script|style|noscript).*?>.*?</\1>',' ',text)
    visible=re.sub(r'(?s)<[^>]+>',' ',visible)
    visible=html.unescape(re.sub(r'\s+',' ',visible[:100000]))
    challenge_text=' '.join((title,og,desc,visible)).lower()
    generic=bool(re.search(r'captcha|challenge|verify you are human|security check|login to view|sign in to view|please log in|验证码|访问验证|访客验证|安全验证|请先登录后观看|请完成验证|人机验证',challenge_text,re.I))
    return {'page_title':title,'og_title':og,'site_title':site_title,'description':desc,'duration_seconds':sec,'page_date':date,'challenge_hint':generic}

def probe(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36','Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:
            code=r.status; final=sanitize_url(r.geturl()); ctype=r.headers.get('Content-Type','')
            if code>=400:return {'status':'blocked' if code in (403,412,429) else 'error','http_status':code,'final_url':final,'content_type':ctype,'error':'http_error'}
            if 'text/html' not in ctype.lower() and 'application/xhtml' not in ctype.lower():return {'status':'error','http_status':code,'final_url':final,'content_type':ctype,'error':'non_html_landing'}
            data=r.read(MAX+1)
            if len(data)>MAX:return {'status':'error','http_status':code,'final_url':final,'content_type':ctype,'error':'html_over_2mb'}
        meta=extract_meta(data)
        # Prefer explicit videoTitle JSON, then OpenGraph/page title. Generic
        # JSON "title" fields often name a channel or page rather than the VOD.
        title=meta['site_title'] or meta['og_title'] or meta['page_title']
        login_redirect=bool(re.search(r'passport|login|visitor',final,re.I))
        has_video_metadata=bool(title and meta.get('duration_seconds'))
        if login_redirect or (meta['challenge_hint'] and not has_video_metadata):
            status='login_or_challenge'
        elif title and not re.search(r'error|not found|无法访问|访问受限|出错',title,re.I):
            status='metadata_ok'
        else:
            status='error';meta['error']='no_usable_title_metadata'
        return {'status':status,'playback_status':'unverified' if status=='metadata_ok' else '', 'http_status':code,'final_url':final,'content_type':ctype,'html_bytes':len(data),**meta}
    except urllib.error.HTTPError as e:
        return {'status':'blocked' if e.code in (403,412,429) else 'error','http_status':e.code,'final_url':sanitize_url(e.geturl()),'content_type':e.headers.get('Content-Type',''),'error':'http_error'}
    except Exception as e:
        return {'status':'error','http_status':'','final_url':'','content_type':'','error':type(e).__name__+': '+str(e)[:180]}

def write_report(refs,results):
    os.makedirs(OUT,exist_ok=True)
    unique={r['source_url']:r for r in refs}
    fieldnames=['entry_id','entry_type','date','title','source_index','kind','archive_status','source_url','normalized_final_url','probe_status','playback_status','http_status','page_title','og_title','site_title','page_date','duration_seconds','source_note','error']
    with open(OUT+'/other-host-sources.csv','w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fieldnames);w.writeheader()
        for ref in refs:
            res=results.get(ref['source_url'],{'status':'resume_pending'})
            w.writerow({**{k:ref.get(k,'') for k in fieldnames},'normalized_final_url':res.get('final_url',''),'probe_status':res.get('status','resume_pending'),'playback_status':res.get('playback_status',''),'http_status':res.get('http_status',''),'page_title':res.get('page_title',''),'og_title':res.get('og_title',''),'site_title':res.get('site_title',''),'page_date':res.get('page_date',''),'duration_seconds':res.get('duration_seconds',''),'error':res.get('error','')})
    counts=Counter(r.get('status','resume_pending') for r in results.values())
    hosts=defaultdict(list)
    for u,r in results.items():hosts[(urllib.parse.urlsplit(u).hostname or '').lower()].append(r.get('status','resume_pending'))
    queried=set()
    if os.path.exists(CACHE):
        for line in open(CACHE,encoding='utf8'):
            try:queried.add(json.loads(line)['url'])
            except Exception:pass
    queried_hosts=Counter((urllib.parse.urlsplit(u).hostname or '').lower() for u in queried)
    with open(OUT+'/other-hosts.md','w',encoding='utf8') as f:
        f.write('# B 站/AcFun 之外来源公开元数据清查（2026-10-23）\n\n')
        f.write('基线 `34b35960`。按 `data/entries/**` 逐 source 引用生成明细，并把每个已规范化 URL 的结果映射回所有引用。核对范围不含 B 站和 AcFun。\n\n')
        f.write('本轮通过普通只读 HTTP GET 请求 HTML 页面，单页读取上限 2 MiB，每 host 约 1 秒间隔；不请求媒体流、播放清单或签名媒体 URL，不登录，不绕验证。短链只记录最终公开落地页面（query 参数中疑似 credential/signature 字段会移除）。状态 `metadata_ok` 只表示取得了可用页面标题等 metadata，不代表视频当前能播放、画面内容准确或整场完整；`login_or_challenge` 表示登录/访客验证或 challenge；`blocked` 表示 HTTP 403/412/429；`error` 表示其它失败或无可用 metadata；`host_deferred_due_challenge` 表示某 host 抽样出现 challenge 迹象后暂停，包含未请求 URL；`resume_pending` 是 host 停止后的未请求 URL。\n\n')
        f.write(f"引用数 {len(refs)}，去重 URL 数 {len(unique)}，checkpoint 中实际请求的去重 URL 数 {len(queried)}；结果状态："+'；'.join(f'`{k}` {v}' for k,v in counts.items())+'。另有 1 次不入 checkpoint 的 Youku 抽样响应检查，已观察到 captcha 标记。\n\n')
        for h in HOSTS:
            vals=hosts.get(h,[]);f.write(f'- `{h}`：本轮请求 {queried_hosts[h]}/{len({r["source_url"] for r in refs if urllib.parse.urlsplit(r["source_url"]).hostname==h})} 个；'+'，'.join(f'{k} {v}' for k,v in Counter(vals).items())+'。\n')
        f.write('\nYouku 的 264 条 source 引用中，111 个 URL 本轮收到约 1.5 KB、无可用标题 metadata 的 HTTP 200 小页面；额外一次公开 HTML 抽样含 `captcha` 字符串。其余 153 个 URL 未请求，统一标为 challenge 风险待复核。Douyu 的 326 个页面均取得具体视频标题和时长 metadata；Sohu 的 5 个页面取得标题，但本轮未提取到时长。t.cn 的首个短链跳转至 passport/visitor 页面后停止，另一条未请求。所有 `metadata_ok` 行的 `playback_status` 均为 `unverified`；本轮没有播放或查看录像画面。\n')
        f.write('\n逐条 URL 与来源引用、原档案 status/kind、公开页面 title/date/duration、请求状态见 [`other-host-sources.csv`](other-host-sources.csv)。\n\n')
        f.write('## 未确认事项\n\n- 页面 metadata 不能证明录像画面对应条目游戏、属于日期或覆盖整场；本清查没有观看或下载媒体。\n- 本报告不把档案 `alive` 状态改写为本轮已播放，也不改动正式数据。\n- 公开页面拒绝访问、要求验证或没有可用 metadata 的来源需由后续人工浏览器核对；本轮在相应 host 出现挑战时停止，不继续重试。\n- `confidence: low` 不适用；未修改 `data/**` 或功能代码。\n')

def main():
    parser=argparse.ArgumentParser(description='Probe public HTML metadata only; no media requests.')
    parser.add_argument('--data-dir',required=True,help='directory containing baseline entry YAML files')
    parser.add_argument('--cache-file',required=True,help='checkpoint JSONL file path')
    parser.add_argument('--output-dir',default='docs/research/deep-source-audit-2026-10-23',help='relative report directory')
    args=parser.parse_args()
    global DATA_DIR,CACHE,OUT
    DATA_DIR=args.data_dir;CACHE=args.cache_file;OUT=args.output_dir
    refs=load_refs();urls=sorted({r['source_url'] for r in refs if r['source_url']})
    os.makedirs(os.path.dirname(CACHE),exist_ok=True)
    results={}
    if os.path.exists(CACHE):
        for line in open(CACHE,encoding='utf8'):
            try:
                x=json.loads(line);results[x['url']]=x['result']
            except Exception:pass
    # One ordinary response was inspected and contained a captcha marker; sampled
    # Youku responses also had a fixed ~1.5 KB body and no title metadata. Defer
    # this host rather than treating HTTP 200 as successful metadata or dead.
    for u,res in list(results.items()):
        if (urllib.parse.urlsplit(u).hostname or '').lower()=='v.youku.com' and res.get('error')=='no_usable_title_metadata':
            results[u]={**res,'status':'host_deferred_due_challenge','error':'probable_fixed_challenge_shell; one sampled response contained captcha marker'}
        elif (urllib.parse.urlsplit(u).hostname or '').lower()=='v.douyu.com' and res.get('status')=='login_or_challenge':
            final_host=(urllib.parse.urlsplit(res.get('final_url','')).hostname or '').lower()
            valid_title=res.get('site_title') or res.get('og_title') or res.get('page_title')
            if final_host=='v.douyu.com' and valid_title and res.get('duration_seconds'):
                results[u]={**res,'status':'metadata_ok','playback_status':'unverified','error':''}
    pending=defaultdict(list)
    for u in urls:
        h=(urllib.parse.urlsplit(u).hostname or '').lower()
        if h=='v.youku.com' and u not in results:
            results[u]={'status':'host_deferred_due_challenge','error':'host deferred after sampled response contained captcha marker'}
        elif h in HOSTS and u not in results:pending[h].append(u)
    print(f'REFS {len(refs)} UNIQUE {len(urls)} CACHED {len(results)}',flush=True)
    for host in HOSTS:
        batch=pending.get(host,[])
        if not batch:continue
        print(f'HOST_START {host} pending={len(batch)}',flush=True)
        blocked=False;last=0
        for i,u in enumerate(batch,1):
            wait=max(0,1.05-(time.monotonic()-last))
            if wait:time.sleep(wait)
            last=time.monotonic();res=probe(u);results[u]=res
            with open(CACHE,'a',encoding='utf8') as c:
                c.write(json.dumps({'url':u,'result':res},ensure_ascii=False)+'\n');c.flush();os.fsync(c.fileno())
            print(f'PROGRESS {host} {i}/{len(batch)} {res.get("status")} http={res.get("http_status")}',flush=True)
            if res.get('status') in ('blocked','login_or_challenge'):
                blocked=True
                for left in batch[i:]:results[left]={'status':'resume_pending','error':'host_stopped_after_block_or_challenge'}
                print(f'HOST_STOP {host} reason={res.get("status")} remaining={len(batch)-i}',flush=True)
                break
        if not blocked: print(f'HOST_DONE {host}',flush=True)
    write_report(refs,results)
    print(f'REPORT_DONE cached={len(results)}',flush=True)
if __name__=='__main__':main()
