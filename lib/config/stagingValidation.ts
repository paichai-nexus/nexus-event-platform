export type StagingValidationEnvironment = Record<string, string | undefined>;

export type StagingValidationResult =
  | { ok: true; projectRef: string }
  | { ok: false; projectRef: string | null; errors: string[] };

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

function entries(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractHttpsOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function extractSupabaseProjectRef(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) return null;
    const match = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function stagingDatabaseTargetsProject(value: string | undefined, projectRef: string) {
  if (!value || !PROJECT_REF_PATTERN.test(projectRef)) return false;
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return false;
    const sslMode = url.searchParams.get("sslmode");
    if (sslMode !== "require" && sslMode !== "verify-full") return false;
    const direct = url.hostname === `db.${projectRef}.supabase.co`;
    const pooled = url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username) === `postgres.${projectRef}`;
    return direct || pooled;
  } catch {
    return false;
  }
}

export function evaluateStagingValidationPolicy(environment: StagingValidationEnvironment): StagingValidationResult {
  const errors: string[] = [];
  const urlProjectRef = extractSupabaseProjectRef(environment.NEXT_PUBLIC_SUPABASE_URL);
  const configuredProjectRef = environment.STAGING_SUPABASE_PROJECT_REF?.trim() ?? "";
  const allowedRefs = entries(environment.STAGING_SUPABASE_PROJECT_REF_ALLOWLIST);
  const productionRefs = entries(environment.PRODUCTION_SUPABASE_PROJECT_REFS);
  const appOrigin = extractHttpsOrigin(environment.APP_BASE_URL);
  const allowedAppOrigins = entries(environment.STAGING_APP_ORIGIN_ALLOWLIST).map(extractHttpsOrigin);
  const productionAppOrigins = entries(environment.PRODUCTION_APP_ORIGINS).map(extractHttpsOrigin);

  if (environment.APP_RUNTIME_MODE !== "staging") errors.push("APP_RUNTIME_MODE=staging is required.");
  if (environment.ALLOW_STAGING_TESTS !== "true") errors.push("ALLOW_STAGING_TESTS=true is required.");
  if (!urlProjectRef) errors.push("NEXT_PUBLIC_SUPABASE_URL must identify an exact hosted Supabase project ref.");
  if (!PROJECT_REF_PATTERN.test(configuredProjectRef)) errors.push("STAGING_SUPABASE_PROJECT_REF must be a valid project ref.");
  if (urlProjectRef && configuredProjectRef && urlProjectRef !== configuredProjectRef) {
    errors.push("Supabase URL project ref does not match STAGING_SUPABASE_PROJECT_REF.");
  }
  if (!allowedRefs.length || allowedRefs.some((ref) => !PROJECT_REF_PATTERN.test(ref))) {
    errors.push("STAGING_SUPABASE_PROJECT_REF_ALLOWLIST must contain valid project refs.");
  } else if (configuredProjectRef && !allowedRefs.includes(configuredProjectRef)) {
    errors.push("Staging project ref is not in the approved allowlist.");
  }
  if (!productionRefs.length || productionRefs.some((ref) => !PROJECT_REF_PATTERN.test(ref))) {
    errors.push("PRODUCTION_SUPABASE_PROJECT_REFS must contain separately registered production refs.");
  } else if (configuredProjectRef && productionRefs.includes(configuredProjectRef)) {
    errors.push("Staging project ref conflicts with a registered production ref.");
  }

  for (const name of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
    if (!environment[name]?.trim()) errors.push(`${name} is required.`);
  }
  if (!appOrigin) errors.push("APP_BASE_URL must be an exact HTTPS origin for staging validation.");
  if (!allowedAppOrigins.length || allowedAppOrigins.some((origin) => !origin)) {
    errors.push("STAGING_APP_ORIGIN_ALLOWLIST must contain exact HTTPS origins.");
  } else if (appOrigin && !allowedAppOrigins.includes(appOrigin)) {
    errors.push("APP_BASE_URL is not in the approved Staging app origin allowlist.");
  }
  if (!productionAppOrigins.length || productionAppOrigins.some((origin) => !origin)) {
    errors.push("PRODUCTION_APP_ORIGINS must contain separately registered Production origins.");
  } else if (appOrigin && productionAppOrigins.includes(appOrigin)) {
    errors.push("APP_BASE_URL conflicts with a registered Production app origin.");
  }
  if (!environment.ATTENDANCE_EXIT_SECRET || environment.ATTENDANCE_EXIT_SECRET.length < 32) {
    errors.push("ATTENDANCE_EXIT_SECRET must contain at least 32 characters.");
  }

  if (errors.length) return { ok: false, projectRef: urlProjectRef, errors };
  return { ok: true, projectRef: configuredProjectRef };
}
