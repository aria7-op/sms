import { PrismaClient } from '../generated/prisma/client.js';

// Disable Redis - using memory cache only
console.log('Redis disabled - using memory cache only');

const prisma = new PrismaClient();

class LibraryCache {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
    this.bookTTL = 1800; // 30 minutes
    this.searchTTL = 900; // 15 minutes
    this.analyticsTTL = 7200; // 2 hours
    this.reportTTL = 3600; // 1 hour
    
    // Memory cache stores
    this.memoryCache = new Map();
    this.cacheTTL = new Map();
    this.schoolBooksSets = new Map(); // For tracking school books
  }

  // Helper method to check if a key is expired
  isExpired(key) {
    const expiry = this.cacheTTL.get(key);
    return expiry && Date.now() > expiry;
  }

  // Generate cache keys
  generateKey(prefix, identifier, schoolId) {
    return `library:${prefix}:${schoolId}:${identifier}`;
  }

  generateListKey(prefix, schoolId, filters = '') {
    return `library:${prefix}:${schoolId}:${filters}`;
  }

  // Cache book data
  async cacheBook(book) {
    try {
      const key = this.generateKey('book', book.id, book.schoolId);
      this.memoryCache.set(key, book);
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
      
      // Also cache in school books list
      await this.addToSchoolBooksList(book.schoolId, book.id);
      
      console.log(`Book ${book.id} cached successfully`);
    } catch (error) {
      console.error('Error caching book:', error);
    }
  }

  // Get book from cache
  async getBook(bookId, schoolId) {
    try {
      const key = this.generateKey('book', bookId, schoolId);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting book from cache:', error);
      return null;
    }
  }

  // Cache book list
  async cacheBookList(schoolId, books, filters = '') {
    try {
      const key = this.generateListKey('books', schoolId, filters);
      this.memoryCache.set(key, books);
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
      
      // Cache individual books
      for (const book of books) {
        await this.cacheBook(book);
      }
      
      console.log(`Book list cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching book list:', error);
    }
  }

  // Get book list from cache
  async getBookList(schoolId, filters = '') {
    try {
      const key = this.generateListKey('books', schoolId, filters);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting book list from cache:', error);
      return null;
    }
  }

  // Cache search results
  async cacheSearchResults(schoolId, searchQuery, results) {
    try {
      const key = this.generateListKey('search', schoolId, searchQuery);
      this.memoryCache.set(key, results);
      this.cacheTTL.set(key, Date.now() + (this.searchTTL * 1000));
      
      console.log(`Search results cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching search results:', error);
    }
  }

  // Get search results from cache
  async getSearchResults(schoolId, searchQuery) {
    try {
      const key = this.generateListKey('search', schoolId, searchQuery);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting search results from cache:', error);
      return null;
    }
  }

  // Cache library analytics
  async cacheLibraryAnalytics(schoolId, analytics, filters = '') {
    try {
      const key = this.generateListKey('analytics', schoolId, filters);
      this.memoryCache.set(key, analytics);
      this.cacheTTL.set(key, Date.now() + (this.analyticsTTL * 1000));
      
      console.log(`Library analytics cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching library analytics:', error);
    }
  }

  // Get library analytics from cache
  async getLibraryAnalytics(schoolId, filters = '') {
    try {
      const key = this.generateListKey('analytics', schoolId, filters);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting library analytics from cache:', error);
      return null;
    }
  }

  // Cache library summary
  async cacheLibrarySummary(schoolId, summary) {
    try {
      const key = this.generateKey('summary', 'dashboard', schoolId);
      this.memoryCache.set(key, summary);
      this.cacheTTL.set(key, Date.now() + (this.analyticsTTL * 1000));
      
      console.log(`Library summary cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching library summary:', error);
    }
  }

  // Get library summary from cache
  async getLibrarySummary(schoolId) {
    try {
      const key = this.generateKey('summary', 'dashboard', schoolId);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting library summary from cache:', error);
      return null;
    }
  }

  // Cache student books
  async cacheStudentBooks(studentId, schoolId, books) {
    try {
      const key = this.generateKey('student', studentId, schoolId);
      this.memoryCache.set(key, books);
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
      
      console.log(`Student books cached for student ${studentId}`);
    } catch (error) {
      console.error('Error caching student books:', error);
    }
  }

  // Get student books from cache
  async getStudentBooks(studentId, schoolId) {
    try {
      const key = this.generateKey('student', studentId, schoolId);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting student books from cache:', error);
      return null;
    }
  }

  // Cache staff books
  async cacheStaffBooks(staffId, schoolId, books) {
    try {
      const key = this.generateKey('staff', staffId, schoolId);
      this.memoryCache.set(key, books);
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
      
      console.log(`Staff books cached for staff ${staffId}`);
    } catch (error) {
      console.error('Error caching staff books:', error);
    }
  }

  // Get staff books from cache
  async getStaffBooks(staffId, schoolId) {
    try {
      const key = this.generateKey('staff', staffId, schoolId);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting staff books from cache:', error);
      return null;
    }
  }

  // Cache overdue books
  async cacheOverdueBooks(schoolId, books) {
    try {
      const key = this.generateKey('overdue', 'list', schoolId);
      this.memoryCache.set(key, books);
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
      
      console.log(`Overdue books cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching overdue books:', error);
    }
  }

  // Get overdue books from cache
  async getOverdueBooks(schoolId) {
    try {
      const key = this.generateKey('overdue', 'list', schoolId);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting overdue books from cache:', error);
      return null;
    }
  }

  // Cache popular books
  async cachePopularBooks(schoolId, books) {
    try {
      const key = this.generateKey('popular', 'list', schoolId);
      this.memoryCache.set(key, books);
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
      
      console.log(`Popular books cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching popular books:', error);
    }
  }

  // Get popular books from cache
  async getPopularBooks(schoolId) {
    try {
      const key = this.generateKey('popular', 'list', schoolId);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting popular books from cache:', error);
      return null;
    }
  }

  // Cache recent issues
  async cacheRecentIssues(schoolId, issues) {
    try {
      const key = this.generateKey('recent', 'issues', schoolId);
      this.memoryCache.set(key, issues);
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
      
      console.log(`Recent issues cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching recent issues:', error);
    }
  }

  // Get recent issues from cache
  async getRecentIssues(schoolId) {
    try {
      const key = this.generateKey('recent', 'issues', schoolId);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting recent issues from cache:', error);
      return null;
    }
  }

  // Add book to school books list (using Set in memory)
  async addToSchoolBooksList(schoolId, bookId) {
    try {
      const key = this.generateKey('school', 'books', schoolId);
      
      if (!this.schoolBooksSets.has(key)) {
        this.schoolBooksSets.set(key, new Set());
      }
      
      this.schoolBooksSets.get(key).add(bookId.toString());
      
      // Set TTL for the entire set
      this.cacheTTL.set(key, Date.now() + (this.bookTTL * 1000));
    } catch (error) {
      console.error('Error adding book to school list:', error);
    }
  }

  // Remove book from school books list
  async removeFromSchoolBooksList(schoolId, bookId) {
    try {
      const key = this.generateKey('school', 'books', schoolId);
      
      if (this.schoolBooksSets.has(key)) {
        this.schoolBooksSets.get(key).delete(bookId.toString());
      }
    } catch (error) {
      console.error('Error removing book from school list:', error);
    }
  }

  // Invalidate book cache
  async invalidateBookCache(bookId, schoolId) {
    try {
      // Delete all keys that might contain this book
      const keysToDelete = [];
      
      // Check all keys in memory cache
      for (const [key, value] of this.memoryCache.entries()) {
        if (key.includes(`:${bookId}:`) || 
            key.includes(`:${schoolId}:`) && 
            (key.includes('student:') || 
             key.includes('staff:') || 
             key.includes('overdue:') || 
             key.includes('popular:') || 
             key.includes('recent:') || 
             key.includes('summary:') || 
             key.includes('books:') || 
             key.includes('search:') || 
             key.includes('analytics:'))) {
          keysToDelete.push(key);
        }
      }
      
      // Delete all matching keys
      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
      }
      
      await this.removeFromSchoolBooksList(schoolId, bookId);
      
      console.log(`Book cache invalidated for book ${bookId}`);
    } catch (error) {
      console.error('Error invalidating book cache:', error);
    }
  }

  // Invalidate school library cache
  async invalidateSchoolLibraryCache(schoolId) {
    try {
      const keysToDelete = [];
      
      // Check all keys in memory cache
      for (const [key] of this.memoryCache.entries()) {
        if (key.includes(`:${schoolId}:`)) {
          keysToDelete.push(key);
        }
      }
      
      // Delete all matching keys
      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
      }
      
      // Also clear school books set
      const schoolBooksKey = this.generateKey('school', 'books', schoolId);
      this.schoolBooksSets.delete(schoolBooksKey);
      this.cacheTTL.delete(schoolBooksKey);
      
      console.log(`School library cache invalidated for school ${schoolId}`);
    } catch (error) {
      console.error('Error invalidating school library cache:', error);
    }
  }

  // Cache library report
  async cacheLibraryReport(schoolId, report, filters = '') {
    try {
      const key = this.generateListKey('report', schoolId, filters);
      this.memoryCache.set(key, report);
      this.cacheTTL.set(key, Date.now() + (this.reportTTL * 1000));
      
      console.log(`Library report cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching library report:', error);
    }
  }

  // Get library report from cache
  async getLibraryReport(schoolId, filters = '') {
    try {
      const key = this.generateListKey('report', schoolId, filters);
      
      if (this.isExpired(key)) {
        this.memoryCache.delete(key);
        this.cacheTTL.delete(key);
        return null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      console.error('Error getting library report from cache:', error);
      return null;
    }
  }

  // Warm up cache with recent books
  async warmUpCache(schoolId) {
    try {
      const recentBooks = await prisma.book.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          subject: { select: { id: true, uuid: true, name: true } },
          _count: {
            select: {
              bookIssues: true,
              reservations: true,
              bookReviews: true
            }
          }
        }
      });

      await this.cacheBookList(schoolId, recentBooks, 'recent');
      
      // Cache individual books
      for (const book of recentBooks) {
        await this.cacheBook(book);
      }
      
      console.log(`Library cache warmed up for school ${schoolId}`);
    } catch (error) {
      console.error('Error warming up library cache:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      return {
        totalKeys: this.memoryCache.size,
        memoryUsage: process.memoryUsage().heapUsed,
        hitRate: 'N/A', // Memory cache doesn't track hits/misses in this implementation
        keyTypes: {
          book: Array.from(this.memoryCache.keys()).filter(k => k.includes(':book:')).length,
          list: Array.from(this.memoryCache.keys()).filter(k => k.includes(':books:')).length,
          search: Array.from(this.memoryCache.keys()).filter(k => k.includes(':search:')).length,
          analytics: Array.from(this.memoryCache.keys()).filter(k => k.includes(':analytics:')).length,
          student: Array.from(this.memoryCache.keys()).filter(k => k.includes(':student:')).length,
          staff: Array.from(this.memoryCache.keys()).filter(k => k.includes(':staff:')).length,
          school: Array.from(this.memoryCache.keys()).filter(k => k.includes(':school:')).length
        }
      };
    } catch (error) {
      console.error('Error getting library cache stats:', error);
      return null;
    }
  }

  // Clear all library cache
  async clearAllLibraryCache() {
    try {
      this.memoryCache.clear();
      this.cacheTTL.clear();
      this.schoolBooksSets.clear();
      
      console.log('All library cache cleared');
    } catch (error) {
      console.error('Error clearing library cache:', error);
    }
  }
}

// Create a single instance of LibraryCache
const libraryCache = new LibraryCache();

// Export the instance and individual methods if needed
export default libraryCache;

// Alternatively, you can export individual methods like this:
export const cacheBook = libraryCache.cacheBook.bind(libraryCache);
export const invalidateBookCache = libraryCache.invalidateBookCache.bind(libraryCache);
// Add other methods you need to export individually