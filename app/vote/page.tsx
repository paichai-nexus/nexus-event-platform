"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/lib/network/resilientFetch";

type Category="STARTUP"|"BUSINESS_ANALYSIS";
type Team={id:string;name:string;category:Category;order:number};
type Choice={category:Category;rank:1|2;teamId:string};
type State={registered:boolean;submitted:boolean;votingStatus:string;votingOpensAt?:string|null;votingAvailable?:boolean;choices:Choice[]};
type Payload={ok:boolean;data:{state:State;teams:Team[];eventId:string}};
const categories:[Category,string][]=[["STARTUP","창업 부문"],["BUSINESS_ANALYSIS","기업분석 부문"]];

export default function VotePage(){
  const [payload,setPayload]=useState<Payload["data"]|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [department,setDepartment]=useState("");
  const [studentNumber,setStudentNumber]=useState("");
  const [fullName,setFullName]=useState("");
  const [pcuCode,setPcuCode]=useState("");
  const [selected,setSelected]=useState<Record<string,string>>({});
  const refresh=useCallback(async()=>{
    try { const res=await requestJson<Payload>("/api/ranked-ballot",{cache:"no-store"});setPayload(res.data); }
    catch(e){setMessage(e instanceof Error?e.message:"상태를 확인하지 못했습니다.");}
    finally{setLoading(false);}
  },[]);
  useEffect(() => {
    // Defer the initial asynchronous read until after effect setup.
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);
  async function register(){
    if(busy)return;setBusy(true);setMessage("");
    try{
      const res=await requestJson<Payload>("/api/ranked-ballot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({department,studentNumber,fullName,pcuCode})});
      setPayload(res.data);setMessage("청중평가단 등록이 완료되었습니다.");
    }catch(e){setMessage(e instanceof Error?e.message:"신청 오류");}
    finally{setBusy(false);}
  }
  async function submit(){
    if(!payload||busy)return;
    const choices:Choice[]=categories.flatMap(([category])=>[1,2].map(rank=>({category,rank:rank as 1|2,teamId:selected[`${category}:${rank}`]??""})));
    if(choices.some(c=>!c.teamId)||new Set(choices.map(c=>c.teamId)).size!==4){setMessage("두 부문 모두 1등·2등을 서로 다른 팀으로 선택해주세요.");return;}
    if(!window.confirm("창업·기업분석 각 부문의 1등과 2등을 제출할까요? 제출 후 수정할 수 없습니다."))return;
    setBusy(true);setMessage("");
    try{
      const res=await requestJson<Payload>("/api/ranked-ballot",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId:payload.eventId,choices})});
      setPayload(res.data);setMessage("투표가 정상 저장되었습니다.");
    }catch(e){setMessage(e instanceof Error?e.message:"투표 저장 오류");}
    finally{setBusy(false);}
  }
  return <main className="participant-page">
    <header className="participant-header"><Link href="/">← 행사 안내</Link><strong>경영대학 학술제 · 청중평가</strong></header>
    <section className="participant-hero"><span>PCU AUDIENCE VOTE</span><h1>청중평가단</h1><p>오전 9시부터 사전 신청을 받고, 미달 학과는 2부 입장 시 자원자를 모집합니다. 종이로 배부된 PCU 번호를 등록하면 오후 5시부터 두 부문에서 각각 1등과 2등을 선택할 수 있습니다.</p>
      <a className="admin-button admin-button--ghost" href="https://docs.google.com/forms/d/e/1FAIpQLSdI09IXEytrl1hxfmjxG_Hwbz4OgDtWzNYjh_yT_mRdl53Ceg/viewform" target="_blank" rel="noopener noreferrer">오전 9시 사전 신청 Google Form 열기</a>
      <p>Google Form 신청만으로 투표권이 발급되지는 않습니다. 현장에서 PCU 인증번호를 받은 뒤 아래 등록을 완료해야 합니다.</p></section>
    <section className="participant-content">
      {loading?<p>연결 확인 중…</p>:!payload?<button className="admin-button" onClick={()=>void refresh()}>다시 시도</button>:
      !payload.state.registered?<article className="is-current"><div><div><strong>청중평가단 등록</strong><small>학과·학번·이름·배부받은 PCU-101~PCU-220 번호</small></div></div>
        <form onSubmit={e=>{e.preventDefault();void register();}} style={{display:"grid",gap:12,width:"100%"}}>
          <label>학과<input required autoComplete="organization" value={department} onChange={e=>setDepartment(e.target.value)} placeholder="컴퓨터공학과" minLength={2} maxLength={80}/></label>
          <label>학번<input required inputMode="numeric" value={studentNumber} onChange={e=>setStudentNumber(e.target.value)} placeholder="학번 숫자" pattern="[0-9]{5,12}"/></label>
          <label>이름<input required autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="성명" minLength={2} maxLength={40}/></label>
          <label>PCU 인증번호<input required value={pcuCode} onChange={e=>setPcuCode(e.target.value.toUpperCase())} placeholder="PCU-101" pattern="PCU-(10[1-9]|1[1-9][0-9]|2[01][0-9]|220)"/></label>
          <button className="admin-button admin-button--primary" type="submit" disabled={busy}>{busy?"등록 중…":"청중평가단 등록"}</button>
        </form></article>:
      payload.state.submitted?<article className="is-current"><strong>투표 완료</strong><p>창업 부문 및 기업분석 부문의 순위 투표가 저장되었습니다. 재투표는 불가능합니다.</p>{payload.state.choices.map(c=><p key={`${c.category}:${c.rank}`}>{c.category==="STARTUP"?"창업":"기업분석"} {c.rank}등: {payload.teams.find(t=>t.id===c.teamId)?.name??"—"}</p>)}</article>:
      <><p className="participant-feedback">등록 완료 · 청중평가: {payload.state.votingAvailable?"투표 가능":"11월 4일 오후 5시 이후 관리자 개방 시 투표 가능"}</p>
      {categories.map(([category,title])=><article key={category} className="is-current" style={{display:"block"}}><h2>{title}</h2>{([1,2] as const).map(rank=><label key={rank} style={{display:"block",margin:"12px 0"}}>{rank}등 선택
        <select style={{display:"block",width:"100%",padding:12}} value={selected[`${category}:${rank}`]??""} onChange={e=>setSelected(prev=>({...prev,[`${category}:${rank}`]:e.target.value}))} disabled={busy||!payload.state.votingAvailable}>
          <option value="">팀을 선택하세요</option>{payload.teams.filter(t=>t.category===category&&t.id!==selected[`${category}:${rank===1?2:1}`]).map(t=><option key={t.id} value={t.id}>{t.order}. {t.name}</option>)}
        </select></label>)}</article>)}
      <button className="admin-button admin-button--primary" disabled={busy||!payload.state.votingAvailable} onClick={()=>void submit()}>{busy?"저장 중…":payload.state.votingAvailable?"1·2등 투표 제출":"관리자 투표 개방 대기"}</button></>}
      <p className="participant-feedback" role="status">{message}</p>
    </section></main>;
}
