import test from "node:test";
import assert from "node:assert/strict";
import { calculateJudgeOnlyRows } from "../features/scoring/lib/judgeOnlyTotals.ts";

const teams = [
 { id: "a", name: "A", category: "STARTUP" as const, order: 1, active: true },
 { id: "b", name: "B", category: "STARTUP" as const, order: 2, active: true },
 { id: "c", name: "C", category: "BUSINESS_ANALYSIS" as const, order: 7, active: true },
];
const score = (teamId: string, judgeSlot: 1|2|3, documentScore=40, presentationScore=80, qnaScore=40, status: "DRAFT" | "SUBMITTED"="SUBMITTED") => ({ teamId,judgeSlot,documentScore,presentationScore,qnaScore,totalScore:documentScore+presentationScore+qnaScore,status });

test("no audience bonus, three submitted judges only, categories ranked separately", () => {
 const rows = calculateJudgeOnlyRows(teams, [score("a",1),score("a",2),score("a",3),score("b",1),score("b",2),score("b",3),score("c",1),score("c",2),score("c",3)]);
 assert.equal(rows.find(x=>x.id==="a")?.total,480);
 assert.equal(rows.find(x=>x.id==="b")?.rank,1);
 assert.equal(rows.find(x=>x.id==="c")?.rank,1);
 assert.equal(rows.find(x=>x.id==="a")?.rank,1);
});

test("draft and missing judges never count as zero scores", () => {
 const rows = calculateJudgeOnlyRows(teams,[score("a",1), score("a",2),score("a",3,40,80,40,"DRAFT")]);
 const a=rows.find(x=>x.id==="a")!;
 assert.equal(a.submittedJudges,2);
 assert.equal(a.total,null);
 assert.equal(a.rank,null);
});

test("600 maximum and invalid or duplicate slots fail closed", () => {
 const max=score("a",1,50,100,50);
 const rows=calculateJudgeOnlyRows(teams,[max,score("a",2,50,100,50),score("a",3,50,100,50)]);
 assert.equal(rows.find(x=>x.id==="a")?.total,600);
 const dup=calculateJudgeOnlyRows(teams,[max,max,score("a",2),score("a",3)]);
 assert.equal(dup.find(x=>x.id==="a")?.total,null);
});
