import { AUDIENCE_JURY_DEPARTMENTS, type AudienceJuryDepartment } from "@/types/audience-jury";

export type AudienceReservationImportRow = {
  department: AudienceJuryDepartment;
  name: string;
  studentNumber: string;
};

export type AudienceReservationParseResult = {
  rows: AudienceReservationImportRow[];
  errors: string[];
};

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  cells.push(value.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").replace(/\s/g, "").toLowerCase();
}

const headerAliases = {
  department: ["학과", "department", "소속학과"],
  name: ["이름", "성명", "name"],
  studentNumber: ["학번", "studentnumber", "studentno", "studentid"],
};

function headerIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

export function parseAudienceReservationRows(table: unknown[][]): AudienceReservationParseResult {
  if (table.length < 2) throw new Error("첫 줄에 학과, 학번, 이름 제목을 포함해주세요.");
  const normalizedTable = table.map((row) => row.map((cell) => cell == null ? "" : String(cell).trim()));
  const headers = normalizedTable[0];
  const departmentIndex = headerIndex(headers, headerAliases.department);
  const nameIndex = headerIndex(headers, headerAliases.name);
  const studentNumberIndex = headerIndex(headers, headerAliases.studentNumber);
  if ([departmentIndex, nameIndex, studentNumberIndex].some((index) => index < 0)) {
    throw new Error("학과, 학번, 이름 열을 찾을 수 없습니다.");
  }

  const rows: AudienceReservationImportRow[] = [];
  const errors: string[] = [];
  normalizedTable.slice(1).forEach((cells, rowIndex) => {
    if (cells.every((cell) => !cell)) return;
    const department = cells[departmentIndex]?.trim() as AudienceJuryDepartment;
    const name = cells[nameIndex]?.trim();
    const studentNumber = cells[studentNumberIndex]?.trim().toUpperCase();
    if (!AUDIENCE_JURY_DEPARTMENTS.includes(department)) {
      errors.push(`${rowIndex + 2}행: 학과명이 6개 운영 학과와 일치하지 않습니다.`);
      return;
    }
    if (!name || name.length < 2 || !studentNumber || !/^[0-9A-Z-]{5,20}$/.test(studentNumber)) {
      errors.push(`${rowIndex + 2}행: 이름 또는 학번 형식을 확인해주세요.`);
      return;
    }
    rows.push({ department, name, studentNumber });
  });
  return { rows, errors };
}

export function parseAudienceReservationText(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim());
  if (!lines.length) throw new Error("예약자 명단이 비어 있습니다.");
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  return parseAudienceReservationRows(lines.map((line) => parseDelimitedLine(line, delimiter)));
}
