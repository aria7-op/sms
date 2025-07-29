// Simple in-memory cache for demonstration
const cache = new Map();

export const getFromCache = async (key) => {
  try {
    return cache.get(key);
  } catch (error) {
    console.error('getFromCache error:', error);
    return null;
  }
};

export const setCache = async (key, value, ttl = 60) => {
  try {
    cache.set(key, value);
    // TTL not implemented in this demo
  } catch (error) {
    console.error('setCache error:', error);
  }
};

export const clearCache = async () => {
  try {
    cache.clear();
  } catch (error) {
    console.error('clearCache error:', error);
  }
};

export const customerCacheMiddleware = (req, res, next) => {
  try {
    // Placeholder: no actual cache logic for now
    next();
  } catch (error) {
    console.error('customerCacheMiddleware error:', error);
    next();
  }
};

export const customerCache = {
  get: (key) => cache.get(key),
  set: (key, value) => cache.set(key, value),
  clear: () => cache.clear(),
  keys: () => Array.from(cache.keys()),
}; 