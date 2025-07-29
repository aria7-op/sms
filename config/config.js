// ======================
// CACHE CONFIGURATION
// ======================

export const CACHE_CONFIG = {
  REDIS_URL: null, // Disable Redis completely
  DEFAULT_TTL: 3600, // 1 hour
  MAX_KEYS: 10000,
  TTL: {
    SUBJECT: 3600, // 1 hour
    SUBJECT_LIST: 1800, // 30 minutes
    SUBJECT_SEARCH: 900, // 15 minutes
    SUBJECT_STATS: 7200, // 2 hours
    SUBJECT_ANALYTICS: 3600, // 1 hour
    SUBJECT_PERFORMANCE: 1800, // 30 minutes
    SUBJECT_EXPORT: 300, // 5 minutes
    SUBJECT_COUNTS: 3600, // 1 hour
  },
  PREFIXES: {
    SUBJECT: 'subject',
    SUBJECT_LIST: 'subject:list',
    SUBJECT_SEARCH: 'subject:search',
    SUBJECT_STATS: 'subject:stats',
    SUBJECT_ANALYTICS: 'subject:analytics',
    SUBJECT_PERFORMANCE: 'subject:performance',
    SUBJECT_EXPORT: 'subject:export',
    SUBJECT_COUNTS: 'subject:counts',
    SUBJECT_BY_SCHOOL: 'subject:school',
    SUBJECT_BY_DEPARTMENT: 'subject:dept',
    SUBJECT_BY_TYPE: 'subject:type',
  },
};
