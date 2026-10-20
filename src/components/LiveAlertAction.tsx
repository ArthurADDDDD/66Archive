'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
const ORIGIN=(process.env.NEXT_PUBLIC_CONTENT_ORIGIN??'').replace(/\/$/,'')
export function LiveAlertAction({action}:{action:'confirm'|'unsubscribe'}) {
  const read=useRef(false),token=useRef(''),busy=useRef(false)
  const [valid,setValid]=useState<boolean|null>(null),[working,setWorking]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('')
  const controller=useRef<AbortController|null>(null)
  useEffect(()=>{
    if(!read.current){
      read.current=true
      token.current=new URLSearchParams(location.hash.slice(1)).get('token')??''
      history.replaceState(null,'',location.pathname)
      setValid(token.current.length>=20&&token.current.length<=180)
    }
    return()=>controller.current?.abort()
  },[])
  async function act(){
    if(busy.current||!valid||done)return
    busy.current=true;setWorking(true);setError('')
    const request=new AbortController();controller.current=request
    const timeout=setTimeout(()=>request.abort(),10000)
    try{
      const response=await fetch(`${ORIGIN}/api/live-alerts/${action}`,{method:'POST',credentials:'omit',signal:request.signal,
        headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token.current})})
      if(response.status===400){setError('链接无效或已过期。请回到首页重新申请订阅。');return}
      if(!response.ok)throw new Error('unavailable')
      const data:unknown=await response.json(),expected=action==='confirm'?'confirmed':'unsubscribed'
      if(!data||typeof data!=='object'||!('status'in data)||data.status!==expected)throw new Error('invalid')
      setDone(true);token.current=''
    }catch{if(!request.signal.aborted||controller.current===request)setError('暂时无法确认操作结果，请稍后重试。重复确认或退订不会产生额外订阅。')}
    finally{clearTimeout(timeout);busy.current=false;setWorking(false)}
  }
  const title=done?(action==='confirm'?'订阅成功，开播时见！':'已经退订。'):(action==='confirm'?'最后一步：确认订阅':'不再接收开播提醒')
  return <div className="rounded-3xl border border-line bg-surface/60 p-6 sm:p-9">
    <h1 className="text-h2 font-semibold text-ink">{title}</h1>
    <p className="mt-4 text-body leading-relaxed text-muted">{done?(action==='confirm'?'从下一场新直播开始，我们会给你发邮件提醒。无需重复提交邮箱。':'你的邮箱已从提醒名单移除。已经发出的邮件无法撤回。'):(action==='confirm'?'打开邮件链接还不算订阅成功。请点击下方「确认订阅」，看到成功提示后，才会在下一场新直播时收到邮件提醒。':'点击下面的按钮，停止接收开播提醒。以后仍可以在首页重新订阅。')}</p>
    {valid===false&&<p role="alert" className="mt-5 text-meta text-today">没有找到有效的邮件链接。请从收到的邮件中打开此页。</p>}
    {error&&<p role="alert" className="mt-5 text-meta text-today">{error}</p>}
    {!done&&action==='confirm'&&valid&&<p className="mt-4 rounded-xl border border-live/35 bg-live/5 p-3 text-control font-medium text-ink">请完成这一步，关闭页面不会自动确认订阅。</p>}
    {!done&&<button type="button" disabled={!valid||working} onClick={act} className="ui-press mt-7 min-h-12 w-full rounded-full bg-live px-5 py-3 text-control font-medium text-base disabled:opacity-40">{working?'正在处理…':action==='confirm'?'确认订阅':'确认退订'}</button>}
    <div className="mt-6 flex justify-between gap-4 text-meta"><Link href="/" className="text-live hover:underline">回到首页</Link><Link href="/privacy/" className="text-muted hover:underline">隐私说明</Link></div>
  </div>
}
