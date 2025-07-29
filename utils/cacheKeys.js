// Supplier cache keys
const supplierCacheKeys = {
  list: (schoolId, filters = {}) => 
    `suppliers:list:${schoolId}:${JSON.stringify(filters)}`,
  detail: (supplierId, schoolId) => 
    `suppliers:detail:${supplierId}:${schoolId}`,
  analytics: (schoolId, filters = {}) => 
    `suppliers:analytics:${schoolId}:${JSON.stringify(filters)}`,
  performance: (supplierId, schoolId) => 
    `suppliers:performance:${supplierId}:${schoolId}`,
  search: (schoolId, query) => 
    `suppliers:search:${schoolId}:${query}`,
  categories: (schoolId) => 
    `suppliers:categories:${schoolId}`,
  dashboard: (schoolId) => 
    `suppliers:dashboard:${schoolId}`,
  reports: (schoolId, filters = {}) => 
    `suppliers:reports:${schoolId}:${JSON.stringify(filters)}`
};

// Update the main cacheKeys object to include suppliers
const cacheKeys = {
  // ... existing keys ...
  suppliers: supplierCacheKeys
};

export default { cacheKeys, supplierCacheKeys }; 