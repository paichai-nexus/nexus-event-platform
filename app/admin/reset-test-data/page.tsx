"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useEventOps } from "@/features/event/context/EventOpsProvider";

type ResetPreview = {
  event: {id:string;mode:string;status:string;result_status:string};
  attendance:number;pcu:number;otherDataCount:number;allowed:boolean;
};

export default function ResetTestDataPage() {
  const {state,refreshOperations}=useEventOps();
  const [preview,setPreview]=useState<ResetPreview|null>(null);
  const [confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{
    if (!state.snapshotReady) return;
    try {
      const response=await fetch(`/api/admin/reset-test-data?eventId=${encodeURIComponent(state.eventId)}`,{cache:"no-store"});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error?.message??"조회 실패");
      setPreview(payload.data);
    } catch(error){setPreview(null);setNotice(error instanceof Error?error.message:"조회 실패");}
  },[state.eventId,state.snapshotReady]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);
  const clear=async()=>{
    if(!preview?.allowed||busy||confirmation!=="초기화")return;
    if(!window.confirm(`행사 ${preview.event.id}의 출석 ${preview.attendance}건 및 PCU 등록을 삭제합니다. 이미 있던 출석 2건도 포함될 수 있습니다. 진행합니까?`))return;
    setBusy(true);
    try {
      const response=await fetch("/api/admin/reset-test-data",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({eventId:preview.event.id,expectedAttendance:preview.attendance,expectedPcu:preview.pcu,confirmation}),
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error?.message??"초기화 실패");
      setConfirmation("");
      setNotice(`초기화 완료: 출석 ${payload.data.attendanceDeleted}건, 평가단 기록 ${payload.data.juryRowsDeleted}건 삭제`);
      await refreshOperations();
      await load();
    } catch(error){setNotice(error instanceof Error?error.message:"초기화 실패");}
    finally{setBusy(false);}
  };
  return <div className="admin-page" style={{maxWidth:820}}>
    <p><Link href="/admin/dashboard">← 운영 대시보드</Link></p>
    <h1>리허설 출석·PCU 데이터 초기화</h1>
    <p>행사 시작 전, 테스트로 등록된 <strong>1·2부 출석과 PCU 평가단 기록 전체</strong>를 삭제합니다. 실제 참가자는 구분되지 않으므로 실등록이 시작되면 사용하면 안 됩니다.</p>
    <section className="admin-card" style={{padding:24,display:"grid",gap:12}}>
      {!preview ? <p>데이터 조회 중이거나 조회 실패했습니다.</p> : <>
        <p>행사 모드: <strong>{preview.event.mode}</strong> · 상태: {preview.event.status}</p>
        <p>출석 기록: <strong>{preview.attendance}건</strong> · PCU 발급: <strong>{preview.pcu}명</strong></p>
        <p>투표·심사·추첨 등 다른 기록: <strong>{preview.otherDataCount}건</strong></p>
        {!preview.allowed && <p role="alert" style={{color:"#ff7676"}}>실행 차단: REHEARSAL 모드이고 공식 업무 기록이 없는 경우에만 초기화할 수 있습니다.</p>}
        <label>실행하려면 <strong>초기화</strong>를 입력하세요.
          <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="초기화" autoComplete="off" />
        </label>
        <button className="admin-button admin-button--primary" type="button" disabled={!preview.allowed||busy||confirmation!=="초기화"} onClick={()=>void clear()}>
          {busy?"초기화 중…":"출석·PCU 테스트 데이터 초기화"}
        </button>
      </>}
      <button className="admin-button" type="button" onClick={()=>void load()} disabled={busy}>현재 건수 새로고침</button>
      {notice&&<p role="status">{notice}</p>}
    </section>
    <p>이 작업은 되돌릴 수 없습니다. 팀·상품 목록·행사 설정은 삭제하지 않습니다.</p>
  </div>;
}
