export type SearchParamValue = string | string[] | undefined;
export type SearchParams = Record<string, SearchParamValue>;

export function readSearchParam(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function readWindowHours(value: SearchParamValue): number | null {
  const raw = readSearchParam(value).trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function isWithinWindow(value: string | null | undefined, windowHours: number | null): boolean {
  if (!windowHours) {
    return true;
  }
  if (!value) {
    return false;
  }
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }
  return Date.now() - timestamp <= windowHours * 60 * 60 * 1000;
}

export function matchesContains(value: string | null | undefined, query: string): boolean {
  if (!query) {
    return true;
  }
  if (!value) {
    return false;
  }
  return value.toLowerCase().includes(query.toLowerCase());
}

export function buildPathWithSearchParams(
  pathname: string,
  params: SearchParams,
  updates: Record<string, string | null | undefined>
): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const current = Array.isArray(value) ? value[0] : value;
    if (typeof current === "string" && current.length > 0) {
      next.set(key, current);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === "string" && value.length > 0) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
  }

  const query = next.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}
