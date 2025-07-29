// Simple in-memory cache for demonstration
const cache = new Map();

export const getCacheStats = async (req, res) => {
  try {
    res.json({ success: true, data: { size: cache.size } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const clearCache = async (req, res) => {
  try {
    cache.clear();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const warmCache = async (req, res) => {
  try {
    // Mock warming cache
    cache.set('warm', true);
    res.json({ success: true, message: 'Cache warmed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCacheKeys = async (req, res) => {
  try {
    res.json({ success: true, data: Array.from(cache.keys()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteCacheKeys = async (req, res) => {
  try {
    const { pattern } = req.params;
    let deleted = 0;
    for (const key of Array.from(cache.keys())) {
      if (key.includes(pattern)) {
        cache.delete(key);
        deleted++;
      }
    }
    res.json({ success: true, message: `Deleted ${deleted} keys` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const optimizeCache = async (req, res) => {
  try {
    // Mock optimization
    res.json({ success: true, message: 'Cache optimized' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 