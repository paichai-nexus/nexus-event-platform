import { describe, expect, test } from "vitest";
import {
  drawWinner,
  getEligibleParticipants,
  type DrawHistory,
  type Participant,
} from "./prize-draw";

const participants: Participant[] = [
  { id: "test-01", displayName: "참가자 01", checkedIn: true },
  { id: "test-02", displayName: "참가자 02", checkedIn: false },
  { id: "test-03", displayName: "참가자 03", checkedIn: true },
  { id: "test-04", displayName: "참가자 04", checkedIn: true },
];

describe("경품 추첨", () => {
  test("체크인한 참가자만 추첨 후보가 된다", () => {
    const candidates = getEligibleParticipants(participants, []);

    expect(candidates.map((participant) => participant.id)).toEqual([
      "test-01",
      "test-03",
      "test-04",
    ]);
  });

  test("이미 당첨된 참가자는 다시 추첨 후보가 되지 않는다", () => {
    const history: DrawHistory[] = [
      {
        participantId: "test-03",
        displayName: "참가자 03",
        drawnAt: "2026-10-08T15:00:00.000Z",
      },
    ];

    const candidates = getEligibleParticipants(participants, history);

    expect(candidates.map((participant) => participant.id)).toEqual([
      "test-01",
      "test-04",
    ]);
  });

  test("추첨할 참가자가 없으면 당첨자를 반환하지 않는다", () => {
    const history: DrawHistory[] = participants
      .filter((participant) => participant.checkedIn)
      .map((participant) => ({
        participantId: participant.id,
        displayName: participant.displayName,
        drawnAt: "2026-10-08T15:00:00.000Z",
      }));

    const winner = drawWinner(participants, history, () => 0);

    expect(winner).toBeNull();
  });

  test("랜덤 값에 따라 후보 중 한 명을 선택한다", () => {
    const winner = drawWinner(participants, [], () => 0.99);

    expect(winner?.id).toBe("test-04");
  });
});