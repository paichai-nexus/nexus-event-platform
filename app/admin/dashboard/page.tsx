"use client";

import { useState } from "react";
import {
  drawWinner,
  getEligibleParticipants,
  type DrawHistory,
  type Participant,
} from "@/features/prize/prize-draw";

import { testParticipants } from "@/features/prize/mock-participants";

export default function Home() {
  const [history, setHistory] = useState<DrawHistory[]>([]);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const eligibleParticipants = getEligibleParticipants(
    testParticipants,
    history,
  );

  const checkedInCount = testParticipants.filter(
    (participant) => participant.checkedIn,
  ).length;

  const handleDraw = () => {
    if (eligibleParticipants.length === 0) {
      setWinner(null);
      return;
    }

    setIsDrawing(true);
    setWinner(null);

    window.setTimeout(() => {
      const selectedWinner = drawWinner(
        testParticipants,
        history,
      );

      if (selectedWinner) {
        const newHistoryItem: DrawHistory = {
          participantId: selectedWinner.id,
          displayName: selectedWinner.displayName,
          drawnAt: new Date().toISOString(),
        };

        setWinner(selectedWinner);
        setHistory((currentHistory) => [
          newHistoryItem,
          ...currentHistory,
        ]);
      }

      setIsDrawing(false);
    }, 700);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-blue-600">
            배재대학교 경영대학 축제
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            경품 추첨
          </h1>

          <p className="mt-2 text-slate-600">
            체크인한 참가자 중 아직 당첨되지 않은 참가자를 추첨합니다.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              체크인 참가자
            </p>

            <p className="mt-2 text-3xl font-bold">
              {checkedInCount}명
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              추첨 가능
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {eligibleParticipants.length}명
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-500">
              현재 당첨자
            </p>

            {winner ? (
              <div className="mt-5 rounded-2xl bg-blue-50 px-6 py-10">
                <p className="text-sm text-blue-600">
                  🎉 축하합니다!
                </p>

                <p className="mt-2 text-4xl font-bold text-blue-700">
                  {winner.displayName}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 px-6 py-10">
                <p className="text-slate-500">
                  아직 추첨하지 않았습니다.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleDraw}
              disabled={isDrawing || eligibleParticipants.length === 0}
              className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isDrawing
                ? "추첨 중..."
                : eligibleParticipants.length === 0
                  ? "추첨 가능한 참가자 없음"
                  : "경품 추첨 시작"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              추첨 이력
            </h2>

            <span className="text-sm text-slate-500">
              총 {history.length}명
            </span>
          </div>

          {history.length === 0 ? (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-slate-500">
              아직 당첨자가 없습니다.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {history.map((item) => (
                <li
                  key={`${item.participantId}-${item.drawnAt}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4"
                >
                  <div>
                    <p className="font-semibold">
                      {item.displayName}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.drawnAt).toLocaleString("ko-KR")}
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    당첨
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800">
            프로토타입 안내
          </p>

          <p className="mt-1 text-sm leading-6 text-amber-700">
            현재 화면은 테스트 참가자 데이터를 사용하는 프로토타입입니다.
            실제 행사에서는 서버와 데이터베이스에서 추첨 권한 및 중복
            당첨 방지를 검증해야 합니다.
          </p>
        </section>
      </div>
    </main>
  );
}