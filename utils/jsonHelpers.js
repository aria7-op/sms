/**
 * Helper function to safely serialize objects containing BigInt values
 * Converts all BigInt values to strings for JSON serialization
 */
export function safeJsonStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

/**
 * Helper function to create a BigInt-safe response object
 * Recursively converts all BigInt values to strings
 */
export function safeResponse(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }));
}

/**
 * Express middleware to handle BigInt serialization automatically
 * Use this to wrap your res.json calls
 */
export function bigIntSafeJson(req, res, next) {
  const originalJson = res.json;
  
  res.json = function(data) {
    const safeData = safeResponse(data);
    return originalJson.call(this, safeData);
  };
  
  next();
} 