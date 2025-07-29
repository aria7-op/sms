import {cacheData, getCachedData, clearCache} from '../cache/cacheManager';
import {createAuditLog} from '../middleware/audit';

class HostelCache {
    constructor() {
        this.cachePrefix = 'hostel';
        this.defaultTTL = 1800; // 30 minutes
        this.shortTTL = 300; // 5 minutes
        this.longTTL = 3600; // 1 hour
    }

    /**
     * Cache hostel data with intelligent TTL
     */
    async cacheHostel(hostelId, data, ttl = null) {
        try {
            const cacheKey = `${this.cachePrefix}:hostel:${hostelId}`;
            const cacheTTL = ttl || this.defaultTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached hostel data for ID: ${hostelId}`);
            return true;
        } catch (error) {
            console.error('Error caching hostel data:', error);
            return false;
        }
    }

    /**
     * Get cached hostel data
     */
    async getCachedHostel(hostelId) {
        try {
            const cacheKey = `${this.cachePrefix}:hostel:${hostelId}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached hostel data for ID: ${hostelId}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached hostel data:', error);
            return null;
        }
    }

    /**
     * Cache hostel list with filters
     */
    async cacheHostelList(filters, data, ttl = null) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:hostels:${Buffer.from(filterString).toString('base64')}`;
            const cacheTTL = ttl || this.shortTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached hostel list with filters: ${filterString}`);
            return true;
        } catch (error) {
            console.error('Error caching hostel list:', error);
            return false;
        }
    }

    /**
     * Get cached hostel list
     */
    async getCachedHostelList(filters) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:hostels:${Buffer.from(filterString).toString('base64')}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached hostel list with filters: ${filterString}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached hostel list:', error);
            return null;
        }
    }

    /**
     * Cache room data
     */
    async cacheRoom(roomId, data, ttl = null) {
        try {
            const cacheKey = `${this.cachePrefix}:room:${roomId}`;
            const cacheTTL = ttl || this.defaultTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached room data for ID: ${roomId}`);
            return true;
        } catch (error) {
            console.error('Error caching room data:', error);
            return false;
        }
    }

    /**
     * Get cached room data
     */
    async getCachedRoom(roomId) {
        try {
            const cacheKey = `${this.cachePrefix}:room:${roomId}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached room data for ID: ${roomId}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached room data:', error);
            return null;
        }
    }

    /**
     * Cache room list
     */
    async cacheRoomList(filters, data, ttl = null) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:rooms:${Buffer.from(filterString).toString('base64')}`;
            const cacheTTL = ttl || this.shortTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached room list with filters: ${filterString}`);
            return true;
        } catch (error) {
            console.error('Error caching room list:', error);
            return false;
        }
    }

    /**
     * Get cached room list
     */
    async getCachedRoomList(filters) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:rooms:${Buffer.from(filterString).toString('base64')}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached room list with filters: ${filterString}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached room list:', error);
            return null;
        }
    }

    /**
     * Cache resident data
     */
    async cacheResident(residentId, data, ttl = null) {
        try {
            const cacheKey = `${this.cachePrefix}:resident:${residentId}`;
            const cacheTTL = ttl || this.defaultTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached resident data for ID: ${residentId}`);
            return true;
        } catch (error) {
            console.error('Error caching resident data:', error);
            return false;
        }
    }

    /**
     * Get cached resident data
     */
    async getCachedResident(residentId) {
        try {
            const cacheKey = `${this.cachePrefix}:resident:${residentId}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached resident data for ID: ${residentId}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached resident data:', error);
            return null;
        }
    }

    /**
     * Cache resident list
     */
    async cacheResidentList(filters, data, ttl = null) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:residents:${Buffer.from(filterString).toString('base64')}`;
            const cacheTTL = ttl || this.shortTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached resident list with filters: ${filterString}`);
            return true;
        } catch (error) {
            console.error('Error caching resident list:', error);
            return false;
        }
    }

    /**
     * Get cached resident list
     */
    async getCachedResidentList(filters) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:residents:${Buffer.from(filterString).toString('base64')}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached resident list with filters: ${filterString}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached resident list:', error);
            return null;
        }
    }

    /**
     * Cache floor data
     */
    async cacheFloor(floorId, data, ttl = null) {
        try {
            const cacheKey = `${this.cachePrefix}:floor:${floorId}`;
            const cacheTTL = ttl || this.defaultTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached floor data for ID: ${floorId}`);
            return true;
        } catch (error) {
            console.error('Error caching floor data:', error);
            return false;
        }
    }

    /**
     * Get cached floor data
     */
    async getCachedFloor(floorId) {
        try {
            const cacheKey = `${this.cachePrefix}:floor:${floorId}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached floor data for ID: ${floorId}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached floor data:', error);
            return null;
        }
    }

    /**
     * Cache analytics data
     */
    async cacheAnalytics(filters, data, ttl = null) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:analytics:${Buffer.from(filterString).toString('base64')}`;
            const cacheTTL = ttl || this.longTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached analytics data with filters: ${filterString}`);
            return true;
        } catch (error) {
            console.error('Error caching analytics data:', error);
            return false;
        }
    }

    /**
     * Get cached analytics data
     */
    async getCachedAnalytics(filters) {
        try {
            const filterString = JSON.stringify(filters);
            const cacheKey = `${this.cachePrefix}:analytics:${Buffer.from(filterString).toString('base64')}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached analytics data with filters: ${filterString}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached analytics data:', error);
            return null;
        }
    }

    /**
     * Cache dashboard data
     */
    async cacheDashboard(schoolId, data, ttl = null) {
        try {
            const cacheKey = `${this.cachePrefix}:dashboard:${schoolId}`;
            const cacheTTL = ttl || this.shortTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached dashboard data for school: ${schoolId}`);
            return true;
        } catch (error) {
            console.error('Error caching dashboard data:', error);
            return false;
        }
    }

    /**
     * Get cached dashboard data
     */
    async getCachedDashboard(schoolId) {
        try {
            const cacheKey = `${this.cachePrefix}:dashboard:${schoolId}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached dashboard data for school: ${schoolId}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached dashboard data:', error);
            return null;
        }
    }

    /**
     * Cache search results
     */
    async cacheSearchResults(query, filters, data, ttl = null) {
        try {
            const searchString = `${query}:${JSON.stringify(filters)}`;
            const cacheKey = `${this.cachePrefix}:search:${Buffer.from(searchString).toString('base64')}`;
            const cacheTTL = ttl || this.shortTTL;
            
            await cacheData(cacheKey, data, cacheTTL);
            
            console.log(`Cached search results for query: ${query}`);
            return true;
        } catch (error) {
            console.error('Error caching search results:', error);
            return false;
        }
    }

    /**
     * Get cached search results
     */
    async getCachedSearchResults(query, filters) {
        try {
            const searchString = `${query}:${JSON.stringify(filters)}`;
            const cacheKey = `${this.cachePrefix}:search:${Buffer.from(searchString).toString('base64')}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                console.log(`Retrieved cached search results for query: ${query}`);
            }
            
            return cachedData;
        } catch (error) {
            console.error('Error getting cached search results:', error);
            return null;
        }
    }

    /**
     * Clear hostel-related cache
     */
    async clearHostelCache(hostelId = null) {
        try {
            if (hostelId) {
                // Clear specific hostel cache
                await clearCache(`${this.cachePrefix}:hostel:${hostelId}`);
                await clearCache(`${this.cachePrefix}:rooms:*`);
                await clearCache(`${this.cachePrefix}:residents:*`);
                await clearCache(`${this.cachePrefix}:floors:*`);
                console.log(`Cleared cache for hostel: ${hostelId}`);
            } else {
                // Clear all hostel cache
                await clearCache(`${this.cachePrefix}:*`);
                console.log('Cleared all hostel cache');
            }
            
            return true;
        } catch (error) {
            console.error('Error clearing hostel cache:', error);
            return false;
        }
    }

    /**
     * Clear room-related cache
     */
    async clearRoomCache(roomId = null) {
        try {
            if (roomId) {
                await clearCache(`${this.cachePrefix}:room:${roomId}`);
                await clearCache(`${this.cachePrefix}:rooms:*`);
                await clearCache(`${this.cachePrefix}:residents:*`);
                console.log(`Cleared cache for room: ${roomId}`);
            } else {
                await clearCache(`${this.cachePrefix}:room:*`);
                await clearCache(`${this.cachePrefix}:rooms:*`);
                console.log('Cleared all room cache');
            }
            
            return true;
        } catch (error) {
            console.error('Error clearing room cache:', error);
            return false;
        }
    }

    /**
     * Clear resident-related cache
     */
    async clearResidentCache(residentId = null) {
        try {
            if (residentId) {
                await clearCache(`${this.cachePrefix}:resident:${residentId}`);
                await clearCache(`${this.cachePrefix}:residents:*`);
                console.log(`Cleared cache for resident: ${residentId}`);
            } else {
                await clearCache(`${this.cachePrefix}:resident:*`);
                await clearCache(`${this.cachePrefix}:residents:*`);
                console.log('Cleared all resident cache');
            }
            
            return true;
        } catch (error) {
            console.error('Error clearing resident cache:', error);
            return false;
        }
    }

    /**
     * Clear floor-related cache
     */
    async clearFloorCache(floorId = null) {
        try {
            if (floorId) {
                await clearCache(`${this.cachePrefix}:floor:${floorId}`);
                await clearCache(`${this.cachePrefix}:floors:*`);
                console.log(`Cleared cache for floor: ${floorId}`);
            } else {
                await clearCache(`${this.cachePrefix}:floor:*`);
                await clearCache(`${this.cachePrefix}:floors:*`);
                console.log('Cleared all floor cache');
            }
            
            return true;
        } catch (error) {
            console.error('Error clearing floor cache:', error);
            return false;
        }
    }

    /**
     * Clear analytics cache
     */
    async clearAnalyticsCache() {
        try {
            await clearCache(`${this.cachePrefix}:analytics:*`);
            await clearCache(`${this.cachePrefix}:dashboard:*`);
            console.log('Cleared analytics and dashboard cache');
            return true;
        } catch (error) {
            console.error('Error clearing analytics cache:', error);
            return false;
        }
    }

    /**
     * Clear search cache
     */
    async clearSearchCache() {
        try {
            await clearCache(`${this.cachePrefix}:search:*`);
            console.log('Cleared search cache');
            return true;
        } catch (error) {
            console.error('Error clearing search cache:', error);
            return false;
        }
    }

    /**
     * Clear all hostel-related cache
     */
    async clearAllHostelCache() {
        try {
            await clearCache(`${this.cachePrefix}:*`);
            console.log('Cleared all hostel-related cache');
            return true;
        } catch (error) {
            console.error('Error clearing all hostel cache:', error);
            return false;
        }
    }

    /**
     * Warm up cache with frequently accessed data
     */
    async warmUpCache(schoolId) {
        try {
            console.log('Warming up hostel cache...');
            
            // Cache dashboard data
            // This would typically fetch and cache dashboard data
            
            // Cache available hostels
            // This would typically fetch and cache available hostels
            
            // Cache analytics
            // This would typically fetch and cache analytics data
            
            console.log('Hostel cache warm-up completed');
            return true;
        } catch (error) {
            console.error('Error warming up hostel cache:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            // This would typically return cache statistics
            return {
                prefix: this.cachePrefix,
                defaultTTL: this.defaultTTL,
                shortTTL: this.shortTTL,
                longTTL: this.longTTL,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return null;
        }
    }
}

export default HostelCache; 