import type { TeamRosterImportRow, TeamRosterParseResult } from "@/types/team-roster-import";
const aliases: Record<string, keyof TeamRosterImportRow> = { "발표순서": "order", "순서": "order", "부문": "category", "팀명": "name", "소속학과": "department", "학과": "department", "대표자": "leaderName", "팀대표": "leaderName", "팀원": "memberNames", "팀원명": "memberNames", "지도교수": "advisorName", "지도교수님": "advisorName", "발표주제": "topic", "주제": "topic", "참가상태": "active" };
const text = (value: unknown) => String(value ?? "").trim();
function category(value: string) { const normalized = value.replaceAll(" ", "").toUpperCase(); if (["창업", "창업부문", "STARTUP"].includes(normalized)) return "STARTUP" as const; if (["기업분석", "기업분석부문", "BUSINESS_ANALYSIS"].includes(normalized)) return "BUSINESS_ANALYSIS" as const; return null; }
export function parseTeamRosterRows(sheet: unknown[][]): TeamRosterParseResult {
  if (sheet.length < 2) return { rows: [], errors: ["열 제목과 팀 데이터가 필요합니다."] };
  const headers = sheet[0].map((value) => aliases[text(value).replaceAll(" ", "")]);
  const required: Array<keyof TeamRosterImportRow> = ["order", "category", "name", "department", "leaderName", "memberNames", "advisorName", "topic"];
  const missing = required.filter((key) => !headers.includes(key));
  if (missing.length) return { rows: [], errors: [`필수 열이 없습니다: ${missing.join(", ")}`] };
  const rows: TeamRosterImportRow[] = []; const errors: string[] = [];
  sheet.slice(1).forEach((values, index) => { if (values.every((value) => !text(value))) return; const raw = Object.fromEntries(headers.map((key, column) => key ? [key, values[column]] : []).filter(([key]) => key)); const order = Number(raw.order); const selectedCategory = category(text(raw.category)); const line = index + 2; if (!Number.isInteger(order) || order < 1 || order > 19) errors.push(`${line}행 발표순서는 1~19 정수여야 합니다.`); if (!selectedCategory) errors.push(`${line}행 부문은 창업 또는 기업분석이어야 합니다.`); const requiredText = ["name", "department", "leaderName", "advisorName", "topic"] as const; requiredText.forEach((key) => { if (!text(raw[key])) errors.push(`${line}행 ${key} 값이 필요합니다.`); }); const members = text(raw.memberNames).split(/[,/·]/).map((item) => item.trim()).filter(Boolean); if (!members.length) errors.push(`${line}행 팀원명이 필요합니다.`); if (selectedCategory && Number.isInteger(order)) rows.push({ order, category: selectedCategory, name: text(raw.name), department: text(raw.department), leaderName: text(raw.leaderName), memberNames: members, advisorName: text(raw.advisorName), topic: text(raw.topic), active: !["불참", "INACTIVE", "N", "FALSE"].includes(text(raw.active).toUpperCase()) }); });
  if (rows.length !== 19) errors.push(`최종 명단은 19팀이어야 합니다. 현재 ${rows.length}팀입니다.`);
  if (new Set(rows.map((row) => row.order)).size !== rows.length) errors.push("발표순서가 중복되었습니다.");
  if (new Set(rows.map((row) => row.name.toLowerCase())).size !== rows.length) errors.push("팀명이 중복되었습니다.");
  if (rows.filter((row) => row.category === "STARTUP").length !== 10 || rows.filter((row) => row.category === "BUSINESS_ANALYSIS").length !== 9) errors.push("부문 구성은 창업 10팀·기업분석 9팀이어야 합니다.");
  return { rows, errors: [...new Set(errors)] };
}
export function parseTeamRosterText(value: string) { const delimiter = value.split(/\r?\n/, 1)[0]?.includes("\t") ? "\t" : ","; return parseTeamRosterRows(value.split(/\r?\n/).filter(Boolean).map((line) => line.split(delimiter))); }
