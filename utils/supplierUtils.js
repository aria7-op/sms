    import logger from './logger';

    /**
     * Generate a unique supplier code
     */
    async function generateSupplierCode(prisma, schoolId, prefix = 'SUP') {
    try {
        // Get the last supplier code for this school
        const lastSupplier = await prisma.inventorySupplier.findFirst({
        where: {
            schoolId,
            code: { startsWith: prefix },
            deletedAt: null
        },
        orderBy: { code: 'desc' },
        select: { code: true }
        });

        let nextNumber = 1;
        if (lastSupplier && lastSupplier.code) {
        const lastNumber = parseInt(lastSupplier.code.replace(prefix, ''), 10);
        if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
        }
        }

        // Format: SUP001, SUP002, etc.
        const code = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

        // Verify uniqueness
        const existing = await prisma.inventorySupplier.findFirst({
        where: { code, schoolId, deletedAt: null }
        });

        if (existing) {
        // If code exists, try next number
        return generateSupplierCode(prisma, schoolId, prefix);
        }

        return code;
    } catch (error) {
        logger.error('Error generating supplier code:', error);
        throw new Error('Failed to generate supplier code');
    }
    }

    /**
     * Calculate supplier rating based on various factors
     */
    async function calculateSupplierRating(prisma, supplierId) {
    try {
        const supplier = await prisma.inventorySupplier.findUnique({
        where: { id: supplierId },
        include: {
            purchaseOrders: {
            where: {
                createdAt: {
                gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last 1 year
                }
            }
            }
        }
        });

        if (!supplier) {
        throw new Error('Supplier not found');
        }

        let totalScore = 0;
        let factorCount = 0;

        // Factor 1: On-time delivery (40% weight)
        const onTimeDeliveries = supplier.purchaseOrders.filter(po => {
        if (!po.expectedDeliveryDate || !po.deliveryDate) return false;
        return po.deliveryDate <= po.expectedDeliveryDate;
        }).length;

        const deliveryScore = supplier.purchaseOrders.length > 0 
        ? (onTimeDeliveries / supplier.purchaseOrders.length) * 5 
        : 3; // Default score if no orders

        totalScore += deliveryScore * 0.4;
        factorCount++;

        // Factor 2: Order completion rate (30% weight)
        const completedOrders = supplier.purchaseOrders.filter(po => 
        po.status === 'COMPLETED'
        ).length;

        const completionScore = supplier.purchaseOrders.length > 0 
        ? (completedOrders / supplier.purchaseOrders.length) * 5 
        : 3;

        totalScore += completionScore * 0.3;
        factorCount++;

        // Factor 3: Communication quality (20% weight)
        // This would typically be based on response times, quality of responses, etc.
        // For now, we'll use a default score
        const communicationScore = 3.5;
        totalScore += communicationScore * 0.2;
        factorCount++;

        // Factor 4: Price competitiveness (10% weight)
        // This would compare prices with market averages
        // For now, we'll use a default score
        const priceScore = 4.0;
        totalScore += priceScore * 0.1;
        factorCount++;

        const finalRating = Math.round(totalScore);
        return Math.max(1, Math.min(5, finalRating)); // Ensure rating is between 1-5
    } catch (error) {
        logger.error(`Error calculating rating for supplier ${supplierId}:`, error);
        return 3; // Default rating
    }
    }

    /**
     * Validate supplier contact information
     */
    function validateSupplierContact(supplier) {
    const errors = [];

    // Check if at least one contact method is provided
    if (!supplier.email && !supplier.phone) {
        errors.push('At least one contact method (email or phone) is required');
    }

    // Validate email format if provided
    if (supplier.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(supplier.email)) {
        errors.push('Invalid email format');
        }
    }

    // Validate phone format if provided
    if (supplier.phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(supplier.phone)) {
        errors.push('Invalid phone number format');
        }
    }

    // Validate website format if provided
    if (supplier.website) {
        try {
        new URL(supplier.website);
        } catch {
        errors.push('Invalid website URL format');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
    }

    /**
     * Format supplier data for display
     */
    function formatSupplierData(supplier) {
    return {
        id: supplier.id,
        uuid: supplier.uuid,
        name: supplier.name,
        code: supplier.code,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state,
        country: supplier.country,
        postalCode: supplier.postalCode,
        website: supplier.website,
        taxId: supplier.taxId,
        bankDetails: supplier.bankDetails,
        paymentTerms: supplier.paymentTerms,
        creditLimit: supplier.creditLimit ? Number(supplier.creditLimit) : null,
        rating: supplier.rating,
        status: supplier.status,
        fullAddress: formatFullAddress(supplier),
        contactInfo: formatContactInfo(supplier),
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt
    };
    }

    /**
     * Format supplier's full address
     */
    function formatFullAddress(supplier) {
    const parts = [
        supplier.address,
        supplier.city,
        supplier.state,
        supplier.postalCode,
        supplier.country
    ].filter(Boolean);

    return parts.join(', ');
    }

    /**
     * Format supplier's contact information
     */
    function formatContactInfo(supplier) {
    const contacts = [];

    if (supplier.contactPerson) {
        contacts.push(supplier.contactPerson);
    }

    if (supplier.email) {
        contacts.push(supplier.email);
    }

    if (supplier.phone) {
        contacts.push(supplier.phone);
    }

    return {
        primary: contacts[0] || 'No contact information',
        secondary: contacts[1] || undefined
    };
    }

    /**
     * Check if supplier is active
     */
    function isSupplierActive(supplier) {
    return supplier.status === 'ACTIVE' && !supplier.deletedAt;
    }

    /**
     * Get supplier status display text
     */
    function getSupplierStatusText(status) {
    const statusMap = {
        'ACTIVE': 'Active',
        'INACTIVE': 'Inactive',
        'SUSPENDED': 'Suspended',
        'BLACKLISTED': 'Blacklisted'
    };

    return statusMap[status] || 'Unknown';
    }

    /**
     * Get supplier rating display
     */
    function getSupplierRatingDisplay(rating) {
    const starMap = {
        1: '⭐',
        2: '⭐⭐',
        3: '⭐⭐⭐',
        4: '⭐⭐⭐⭐',
        5: '⭐⭐⭐⭐⭐'
    };

    const textMap = {
        1: 'Poor',
        2: 'Fair',
        3: 'Good',
        4: 'Very Good',
        5: 'Excellent'
    };

    const colorMap = {
        1: '#ff4444',
        2: '#ff8800',
        3: '#ffbb33',
        4: '#00C851',
        5: '#007E33'
    };

    return {
        stars: starMap[rating] || '⭐⭐⭐',
        text: textMap[rating] || 'Good',
        color: colorMap[rating] || '#ffbb33'
    };
    }

    /**
     * Calculate supplier performance metrics
     */
    async function calculateSupplierPerformance(prisma, supplierId, startDate, endDate) {
    try {
        const whereClause = { supplierId };
        
        if (startDate && endDate) {
        whereClause.createdAt = {
            gte: startDate,
            lte: endDate
        };
        }

        const [
        totalOrders,
        completedOrders,
        totalSpent,
        averageOrderValue,
        onTimeDeliveries,
        lateDeliveries
        ] = await Promise.all([
        // Total orders
        prisma.purchaseOrder.count({ where: whereClause }),
        
        // Completed orders
        prisma.purchaseOrder.count({
            where: { ...whereClause, status: 'COMPLETED' }
        }),
        
        // Total amount spent
        prisma.purchaseOrder.aggregate({
            where: whereClause,
            _sum: { totalAmount: true }
        }),
        
        // Average order value
        prisma.purchaseOrder.aggregate({
            where: whereClause,
            _avg: { totalAmount: true }
        }),
        
        // On-time deliveries
        prisma.purchaseOrder.count({
            where: {
            ...whereClause,
            deliveryDate: { not: null },
            expectedDeliveryDate: { not: null },
            deliveryDate: { lte: { $ref: 'expectedDeliveryDate' } }
            }
        }),
        
        // Late deliveries
        prisma.purchaseOrder.count({
            where: {
            ...whereClause,
            deliveryDate: { not: null },
            expectedDeliveryDate: { not: null },
            deliveryDate: { gt: { $ref: 'expectedDeliveryDate' } }
            }
        })
        ]);

        const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
        const onTimeRate = totalOrders > 0 ? (onTimeDeliveries / totalOrders) * 100 : 0;
        const averageSpent = totalSpent._sum.totalAmount ? Number(totalSpent._sum.totalAmount) : 0;
        const avgOrderValue = averageOrderValue._avg.totalAmount ? Number(averageOrderValue._avg.totalAmount) : 0;

        return {
        totalOrders,
        completedOrders,
        completionRate: Math.round(completionRate * 100) / 100,
        totalSpent: averageSpent,
        averageOrderValue: avgOrderValue,
        onTimeDeliveries,
        lateDeliveries,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        performanceScore: calculatePerformanceScore({
            completionRate,
            onTimeRate,
            totalOrders
        })
        };
    } catch (error) {
        logger.error(`Error calculating performance for supplier ${supplierId}:`, error);
        throw error;
    }
    }

    /**
     * Calculate overall performance score
     */
    function calculatePerformanceScore(metrics) {
    const { completionRate, onTimeRate, totalOrders } = metrics;
    
    if (totalOrders === 0) return 0;
    
    // Weighted score: 60% completion rate + 40% on-time rate
    const score = (completionRate * 0.6) + (onTimeRate * 0.4);
    
    return Math.round(score * 100) / 100;
    }

    /**
     * Generate supplier report data
     */
    async function generateSupplierReport(prisma, schoolId, filters) {
    try {
        const { startDate, endDate, supplierIds, status } = filters;

        const whereClause = { schoolId, deletedAt: null };
        
        if (supplierIds && supplierIds.length > 0) {
        whereClause.id = { in: supplierIds };
        }
        
        if (status) {
        whereClause.status = status;
        }

        const suppliers = await prisma.inventorySupplier.findMany({
        where: whereClause,
        include: {
            purchaseOrders: {
            where: startDate && endDate ? {
                createdAt: { gte: startDate, lte: endDate }
            } : undefined
            },
            items: {
            select: { id: true, name: true, quantity: true }
            }
        }
        });

        const reportData = suppliers.map(supplier => {
        const totalOrders = supplier.purchaseOrders.length;
        const totalSpent = supplier.purchaseOrders.reduce(
            (sum, po) => sum + Number(po.totalAmount), 0
        );
        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
        const totalItems = supplier.items.length;

        return {
            id: supplier.id,
            name: supplier.name,
            code: supplier.code,
            status: supplier.status,
            rating: supplier.rating,
            totalOrders,
            totalSpent,
            averageOrderValue,
            totalItems,
            contactPerson: supplier.contactPerson,
            email: supplier.email,
            phone: supplier.phone
        };
        });

        return {
        suppliers: reportData,
        summary: {
            totalSuppliers: suppliers.length,
            activeSuppliers: suppliers.filter(s => s.status === 'ACTIVE').length,
            totalOrders: suppliers.reduce((sum, s) => sum + s.purchaseOrders.length, 0),
            totalSpent: suppliers.reduce((sum, s) => 
            sum + s.purchaseOrders.reduce((poSum, po) => poSum + Number(po.totalAmount), 0), 0
            ),
            averageRating: suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length
        },
        generatedAt: new Date(),
        filters
        };
    } catch (error) {
        logger.error('Error generating supplier report:', error);
        throw error;
    }
    }

    /**
     * Validate supplier bank details
     */
    function validateBankDetails(bankDetails) {
    const errors = [];

    if (!bankDetails) return { isValid: true, errors: [] };

    if (bankDetails.accountNumber && typeof bankDetails.accountNumber !== 'string') {
        errors.push('Account number must be a string');
    }

    if (bankDetails.bankName && typeof bankDetails.bankName !== 'string') {
        errors.push('Bank name must be a string');
    }

    if (bankDetails.ifscCode && typeof bankDetails.ifscCode !== 'string') {
        errors.push('IFSC code must be a string');
    }

    if (bankDetails.accountType && !['savings', 'current', 'business'].includes(bankDetails.accountType)) {
        errors.push('Invalid account type');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
    }

    /**
     * Sanitize supplier data for API responses
     */
    function sanitizeSupplierData(supplier) {
    const sanitized = { ...supplier };
    
    // Remove sensitive information
    delete sanitized.bankDetails;
    delete sanitized.taxId;
    
    return sanitized;
    }

    export default {
    generateSupplierCode,
    calculateSupplierRating,
    validateSupplierContact,
    formatSupplierData,
    formatFullAddress,
    formatContactInfo,
    isSupplierActive,
    getSupplierStatusText,
    getSupplierRatingDisplay,
    calculateSupplierPerformance,
    calculatePerformanceScore,
    generateSupplierReport,
    validateBankDetails,
    sanitizeSupplierData
    }; 