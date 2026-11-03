"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/network/resilientFetch";

export default function AudienceJuryAuthPage() {
  const router = useRouter();
  const [studentNumber, setStudentNumber] = useState("");
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      await requestJson("/api/audience-jury/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber, name, serialNumber }),
      });
      router.replace("/vote/ballot");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "본인 인증에 실패했습니다.");
      setPending(false);
    }
  };

  return <main className="participant-page">
    <header className="participant-header"><Link href="/vote">← 등록 화면</Link><div><strong>청중평가단 본인 인증</strong><small>IDENTITY CHECK</small></div><span /></header>
    <section className="participant-hero"><span>2-STEP ACCESS</span><h1>평가 입장 인증</h1><p>선착순 등록 정보와 발급된 PCU 참가자 비밀번호가 모두 일치해야 평가 페이지에 입장할 수 있습니다.</p></section>
    <section className="participant-content">
      <section className="jury-registration jury-auth-card">
        <header><small>REGISTERED AUDIENCE JURY ONLY</small><h2>2차 본인 확인</h2><p>이름·학번·PCU 참가자 비밀번호를 대조합니다. 인증 세션은 이 브라우저에서만 유효합니다.</p></header>
        <form onSubmit={authenticate}>
          <label><span>학번</span><input required autoComplete="off" inputMode="numeric" maxLength={20} placeholder="등록한 학번" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} /></label>
          <label><span>이름</span><input required autoComplete="name" maxLength={30} placeholder="등록한 이름" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="jury-auth-card__serial"><span>PCU 참가자 비밀번호</span><input required autoComplete="off" autoCapitalize="characters" maxLength={7} placeholder="PCU-101" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value.toUpperCase())} /></label>
          <button className="admin-button admin-button--primary" type="submit" disabled={pending || !studentNumber.trim() || !name.trim() || !serialNumber.trim()}>{pending ? "3개 정보 대조 중" : "2차 인증 후 평가 페이지 입장"}</button>
        </form>
        <p className="jury-privacy-note">세 항목 중 하나라도 일치하지 않으면 인증 세션을 발급하지 않습니다. PCU 코드는 타인과 공유하지 마세요.</p>
      </section>
      <p className="participant-feedback" role="alert">{message}</p>
    </section>
  </main>;
}
