"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error?.message ?? "로그인하지 못했습니다.");
        return;
      }
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const fallback = payload.data?.role === "JUDGE" ? "/judge" : "/admin/dashboard";
      router.replace(requestedNext?.startsWith("/") ? requestedNext : fallback);
      router.refresh();
    } catch {
      setMessage("서버에 연결하지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <span>ADMIN ONLY</span>
        <h1>행사 운영 콘솔</h1>
        <p>사전에 등록된 운영 계정으로 로그인하세요.</p>
        <form onSubmit={submit}>
          <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required /></label>
          <button className="admin-button admin-button--primary admin-button--large" type="submit" disabled={pending}>{pending ? "확인 중…" : "로그인"}</button>
        </form>
        {message && <p className="participant-feedback" role="alert">{message}</p>}
      </section>
    </main>
  );
}
