import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const excluded = new Set(["package-lock.json"]);
const patterns = [
  ["Supabase service role JWT", /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9_]{30,}/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
const findings = [];

for (const file of tracked) {
  if (excluded.has(file)) continue;
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed (${tracked.length} tracked files inspected).`);
}
