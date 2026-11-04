"use client";

import { useEffect, useState } from "react";
import { downloadCsv } from "@/features/export/lib/downloadCsv";

type ScoreTeam = {
  id: string;
  name: string;
  category: string;
  order: number;
  judgeSlots: Array<number | null>;
  submittedJudges: number;
  total: number | null;
  complete: boolean;
  rank: number | null;
};

type ScoreData = {
  maxScore: number;
  judgeCount: number;
  teams: ScoreTeam[];
  updatedAt: string;
};

export function LiveScoringBoard({
  eventId
}: {
  eventId: string
}) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;

    let active = true;

    async function load() {
      try {
        const response = await fetch(
          `/api/scoring/live?eventId=${encodeURIComponent(eventId)}`,
          { cache: "no-store" }
        );

        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.error?.message ??
            payload.error ??
            "집계 조회 실패"
          );
        }

        if (active) {
          setData(payload.data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setData(null);
          setError(
            err instanceof Error ? err.message : "조회 오류"
          );
        }
      }
    }

    void load();
    const timer = setInterval(() => void load(), 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [eventId]);

  const teams = data?.teams ?? [];
  const categories = ["BUSINESS_ANALYSIS", "STARTUP"];

  function exportCsv() {
    const rows = teams.map(team => ({
      category: team.category,
      rank: team.rank ?? "미확정",
      teamName: team.name,
      judge1: team.judgeSlots[0] ?? "미제출",
      judge2: team.judgeSlots[1] ?? "미제출",
      judge3: team.judgeSlots[2] ?? "미제출",
      total: team.total ?? "미확정",
      status: team.complete ? "제출 완료" : `${team.submittedJudges}/3 제출`,
    }));
    downloadCsv("nexus-judge-only-600.csv", rows);
  }

  return (
    <section className="admin-card" style={{ padding: 24 }}>
      <h2>심사위원 최종 점수 집계</h2>
      <p>심사위원 3명 × 200점 = 600점 만점</p>
      <p>청중평가 0점 · 600점 만점 · 5초 자동 갱신</p>

      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>점수 조회 중...</p>}

      {data && (
        <>
          <button
            className="admin-button"
            onClick={exportCsv}
            type="button"
          >
            CSV 다운로드
          </button>

          {categories.map(category => {
            const rows = teams
              .filter(team => team.category === category)
              .sort((a, b) => {
                if (a.total === null && b.total === null)
                  return a.order - b.order;
                if (a.total === null) return 1;
                if (b.total === null) return -1;
                return b.total - a.total;
              });

            return (
              <div key={category} style={{ marginTop: 24 }}>
                <h3>
                  {category === "STARTUP"
                    ? "창업 부문"
                    : "기업분석 부문"}
                </h3>

                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse"
                  }}>
                    <thead>
                      <tr>
                        {[
                          "순위", "팀명", "심사1",
                          "심사2", "심사3", "합계", "상태"
                        ].map(col => (
                          <th key={col} style={{
                            padding: 10,
                            borderBottom: "1px solid #888"
                          }}>{col}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map(team => (
                        <tr key={team.id}>
                          <td>{team.rank ?? "—"}</td>
                          <td>{team.name}</td>
                          {team.judgeSlots.map((v, i) => (
                            <td key={i}>{v ?? "—"}</td>
                          ))}
                          <td>
                            <strong>{team.total ?? "—"}</strong>
                          </td>
                          <td>
                            {team.complete
                              ? "집계 완료"
                              : `${team.submittedJudges}/3 제출`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <p style={{ marginTop: 20 }}>
            이 점수는 관리자 검토용입니다.
            공식 시상 결과는 별도 승인 후 공개합니다.
          </p>
        </>
      )}
    </section>
  );
}
