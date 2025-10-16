
export function paginate(p?: {
  skip?: number;
  take?: number;
  includePaginationCount?: boolean;
}) {
  return {
    skip: p?.skip ?? 0,
    take: Math.min(Math.max(p?.take ?? 20, 1), 100),
    includePaginationCount:
      p?.includePaginationCount === undefined ? true : p.includePaginationCount,
  };
}
export function orderBy(
  field = "createdAt",
  direction: "asc" | "desc" = "desc",
) {
  return { [field]: direction } as any;
}
export const like = (s?: string) =>
  s?.trim() ? { contains: s.trim(), mode: "insensitive" as const } : undefined;
