// import Redis from 'ioredis';
import { redis } from './cacheManager.js';
import { PrismaClient } from '../generated/prisma/client.js';

// const redis = new Redis({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: process.env.REDIS_PORT || 6379,
//   password: process.env.REDIS_PASSWORD,
//   db: process.env.REDIS_DB || 0,
//   retryDelayOnFailover: 100,
//   maxRetriesPerRequest: 3
// });

const prisma = new PrismaClient();

class PaymentCache {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
    this.paymentTTL = 1800; // 30 minutes
    this.analyticsTTL = 7200; // 2 hours
    this.reportTTL = 3600; // 1 hour
  }

  // Generate cache keys
  generateKey(prefix, identifier, schoolId) {
    return `payment:${prefix}:${schoolId}:${identifier}`;
  }

  generateListKey(prefix, schoolId, filters = '') {
    return `payment:${prefix}:${schoolId}:${filters}`;
  }

  // Cache payment data
  async cachePayment(payment) {
    try {
      const key = this.generateKey('data', payment.id, payment.schoolId);
      const paymentData = JSON.stringify(payment, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
      
      await redis.setex(key, this.paymentTTL, paymentData);
      
      // Also cache in school payments list
      await this.addToSchoolPaymentsList(payment.schoolId, payment.id);
      
      console.log(`Payment ${payment.id} cached successfully`);
    } catch (error) {
      console.error('Error caching payment:', error);
    }
  }

  // Get payment from cache
  async getPayment(paymentId, schoolId) {
    try {
      const key = this.generateKey('data', paymentId, schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment from cache:', error);
      return null;
    }
  }

  // Cache payment list
  async cachePaymentList(schoolId, payments, filters = '') {
    try {
      const key = this.generateListKey('list', schoolId, filters);
      const paymentsData = JSON.stringify(payments, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
      
      await redis.setex(key, this.paymentTTL, paymentsData);
      
      // Cache individual payments
      for (const payment of payments) {
        await this.cachePayment(payment);
      }
      
      console.log(`Payment list cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching payment list:', error);
    }
  }

  // Get payment list from cache
  async getPaymentList(schoolId, filters = '') {
    try {
      const key = this.generateListKey('list', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment list from cache:', error);
      return null;
    }
  }

  // Cache payment analytics
  async cachePaymentAnalytics(schoolId, analytics, filters = '') {
    try {
      const key = this.generateListKey('analytics', schoolId, filters);
      const analyticsData = JSON.stringify(analytics);
      
      await redis.setex(key, this.analyticsTTL, analyticsData);
      
      console.log(`Payment analytics cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching payment analytics:', error);
    }
  }

  // Get payment analytics from cache
  async getPaymentAnalytics(schoolId, filters = '') {
    try {
      const key = this.generateListKey('analytics', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment analytics from cache:', error);
      return null;
    }
  }

  // Cache payment summary
  async cachePaymentSummary(schoolId, summary) {
    try {
      const key = this.generateKey('summary', 'dashboard', schoolId);
      const summaryData = JSON.stringify(summary);
      
      await redis.setex(key, this.analyticsTTL, summaryData);
      
      console.log(`Payment summary cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching payment summary:', error);
    }
  }

  // Get payment summary from cache
  async getPaymentSummary(schoolId) {
    try {
      const key = this.generateKey('summary', 'dashboard', schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment summary from cache:', error);
      return null;
    }
  }

  // Cache student payments
  async cacheStudentPayments(studentId, schoolId, payments) {
    try {
      const key = this.generateKey('student', studentId, schoolId);
      const paymentsData = JSON.stringify(payments);
      
      await redis.setex(key, this.paymentTTL, paymentsData);
      
      console.log(`Student payments cached for student ${studentId}`);
    } catch (error) {
      console.error('Error caching student payments:', error);
    }
  }

  // Get student payments from cache
  async getStudentPayments(studentId, schoolId) {
    try {
      const key = this.generateKey('student', studentId, schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting student payments from cache:', error);
      return null;
    }
  }

  // Cache parent payments
  async cacheParentPayments(parentId, schoolId, payments) {
    try {
      const key = this.generateKey('parent', parentId, schoolId);
      const paymentsData = JSON.stringify(payments);
      
      await redis.setex(key, this.paymentTTL, paymentsData);
      
      console.log(`Parent payments cached for parent ${parentId}`);
    } catch (error) {
      console.error('Error caching parent payments:', error);
    }
  }

  // Get parent payments from cache
  async getParentPayments(parentId, schoolId) {
    try {
      const key = this.generateKey('parent', parentId, schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting parent payments from cache:', error);
      return null;
    }
  }

  // Cache overdue payments
  async cacheOverduePayments(schoolId, payments) {
    try {
      const key = this.generateKey('overdue', 'list', schoolId);
      const paymentsData = JSON.stringify(payments);
      
      await redis.setex(key, this.paymentTTL, paymentsData);
      
      console.log(`Overdue payments cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching overdue payments:', error);
    }
  }

  // Get overdue payments from cache
  async getOverduePayments(schoolId) {
    try {
      const key = this.generateKey('overdue', 'list', schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting overdue payments from cache:', error);
      return null;
    }
  }

  // Cache recent payments
  async cacheRecentPayments(schoolId, payments) {
    try {
      const key = this.generateKey('recent', 'list', schoolId);
      const paymentsData = JSON.stringify(payments);
      
      await redis.setex(key, this.paymentTTL, paymentsData);
      
      console.log(`Recent payments cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching recent payments:', error);
    }
  }

  // Get recent payments from cache
  async getRecentPayments(schoolId) {
    try {
      const key = this.generateKey('recent', 'list', schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting recent payments from cache:', error);
      return null;
    }
  }

  // Add payment to school payments list
  async addToSchoolPaymentsList(schoolId, paymentId) {
    try {
      const key = this.generateKey('school', 'payments', schoolId);
      await redis.sadd(key, paymentId.toString());
      await redis.expire(key, this.paymentTTL);
    } catch (error) {
      console.error('Error adding payment to school list:', error);
    }
  }

  // Remove payment from school payments list
  async removeFromSchoolPaymentsList(schoolId, paymentId) {
    try {
      const key = this.generateKey('school', 'payments', schoolId);
      await redis.srem(key, paymentId.toString());
    } catch (error) {
      console.error('Error removing payment from school list:', error);
    }
  }

  // Invalidate payment cache
  async invalidatePaymentCache(paymentId, schoolId) {
    try {
      const keys = [
        this.generateKey('data', paymentId, schoolId),
        this.generateKey('student', '*', schoolId),
        this.generateKey('parent', '*', schoolId),
        this.generateKey('overdue', 'list', schoolId),
        this.generateKey('recent', 'list', schoolId),
        this.generateKey('summary', 'dashboard', schoolId),
        this.generateListKey('list', schoolId, '*'),
        this.generateListKey('analytics', schoolId, '*')
      ];

      for (const key of keys) {
        await redis.del(key);
      }

      await this.removeFromSchoolPaymentsList(schoolId, paymentId);
      
      console.log(`Payment cache invalidated for payment ${paymentId}`);
    } catch (error) {
      console.error('Error invalidating payment cache:', error);
    }
  }

  // Invalidate school payment cache
  async invalidateSchoolPaymentCache(schoolId) {
    try {
      const pattern = `payment:*:${schoolId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      console.log(`School payment cache invalidated for school ${schoolId}`);
    } catch (error) {
      console.error('Error invalidating school payment cache:', error);
    }
  }

  // Cache payment report
  async cachePaymentReport(schoolId, report, filters = '') {
    try {
      const key = this.generateListKey('report', schoolId, filters);
      const reportData = JSON.stringify(report);
      
      await redis.setex(key, this.reportTTL, reportData);
      
      console.log(`Payment report cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching payment report:', error);
    }
  }

  // Get payment report from cache
  async getPaymentReport(schoolId, filters = '') {
    try {
      const key = this.generateListKey('report', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment report from cache:', error);
      return null;
    }
  }

  // Warm up cache with recent payments
  async warmUpCache(schoolId) {
    try {
      const recentPayments = await prisma.payment.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          parent: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          feeStructure: { select: { id: true, uuid: true, name: true } },
          items: { include: { feeItem: true } }
        }
      });

      await this.cacheRecentPayments(schoolId, recentPayments);
      
      // Cache individual payments
      for (const payment of recentPayments) {
        await this.cachePayment(payment);
      }
      
      console.log(`Cache warmed up for school ${schoolId}`);
    } catch (error) {
      console.error('Error warming up cache:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const info = await redis.info();
      const keys = await redis.dbsize();
      
      return {
        info,
        totalKeys: keys,
        memory: await redis.memory('USAGE')
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  // Clear all payment cache
  async clearAllPaymentCache() {
    try {
      const pattern = 'payment:*';
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      console.log('All payment cache cleared');
    } catch (error) {
      console.error('Error clearing payment cache:', error);
    }
  }
}

export default new PaymentCache(); 