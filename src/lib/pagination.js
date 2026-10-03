export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const PAGE_SIZE_OPTIONS = [
  { value: 10, label: "10 / page" },
  { value: 25, label: "25 / page" },
  { value: 50, label: "50 / page" },
  { value: 100, label: "100 / page" },
];

export function getPaginationConfig() {
  return {
    defaultLimit: DEFAULT_PAGE_SIZE,
    maxLimit: MAX_PAGE_SIZE,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}

export function parsePagination(searchParams, defaultLimit = DEFAULT_PAGE_SIZE) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPagination({ page, limit, total }) {
  const totalPages = Math.ceil(total / limit) || 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
    from: total === 0 ? 0 : (page - 1) * limit + 1,
    to: Math.min(page * limit, total),
  };
}

/** Full pagination payload for list APIs — frontend must use this, not hardcoded sizes. */
export function buildListPagination({ page, limit, total }) {
  return {
    ...buildPagination({ page, limit, total }),
    ...getPaginationConfig(),
  };
}
