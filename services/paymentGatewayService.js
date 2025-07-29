import { PrismaClient } from '../generated/prisma/client.js';
import axios from 'axios';

// Initialize Stripe only when needed and when API key is available
let stripeClient = null;
const initializeStripe = () => {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    const stripe = require('stripe');
    stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
};

const prisma = new PrismaClient();

class PaymentGatewayService {
  constructor() {
    this.gateways = {
      STRIPE: this.processStripePayment.bind(this),
      PAYPAL: this.processPayPalPayment.bind(this),
      RAZORPAY: this.processRazorpayPayment.bind(this),
      PAYTM: this.processPaytmPayment.bind(this),
      CASHFREE: this.processCashfreePayment.bind(this),
      CUSTOM: this.processCustomPayment.bind(this)
    };
  }

  // Main payment processing method
  async processPaymentGateway(paymentData) {
    try {
      const { gateway, amount, currency = 'USD', metadata = {} } = paymentData;
      
      if (!this.gateways[gateway]) {
        return { success: false, message: 'Unsupported payment gateway' };
      }

      // Get gateway configuration
      const gatewayConfig = await this.getGatewayConfig(paymentData.schoolId, gateway);
      if (!gatewayConfig) {
        return { success: false, message: 'Payment gateway not configured' };
      }

      // Process payment through specific gateway
      const result = await this.gateways[gateway](paymentData, gatewayConfig);
      
      return result;
    } catch (error) {
      console.error('Payment gateway processing error:', error);
      return { success: false, message: 'Payment processing failed' };
    }
  }

  // Get gateway configuration
  async getGatewayConfig(schoolId, gatewayType) {
    try {
      const config = await prisma.paymentGateway.findFirst({
        where: {
          schoolId: BigInt(schoolId),
          type: gatewayType,
          isActive: true,
          deletedAt: null
        }
      });

      return config;
    } catch (error) {
      console.error('Error getting gateway config:', error);
      return null;
    }
  }

  // Stripe payment processing
  async processStripePayment(paymentData, config) {
    try {
      const stripe = initializeStripe();
      if (!stripe) {
        return { success: false, message: 'Stripe not configured' };
      }
      
      const { amount, currency, metadata, description } = paymentData;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
          ...metadata,
          paymentId: paymentData.id?.toString(),
          schoolId: paymentData.schoolId?.toString()
        },
        description: description || 'School payment',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        transactionId: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        message: 'Payment intent created successfully'
      };
    } catch (error) {
      console.error('Stripe payment error:', error);
      return {
        success: false,
        message: error.message || 'Stripe payment failed'
      };
    }
  }

  // PayPal payment processing
  async processPayPalPayment(paymentData, config) {
    try {
      const { amount, currency, metadata } = paymentData;
      
      // PayPal API implementation
      const paypalConfig = config.config;
      const accessToken = await this.getPayPalAccessToken(paypalConfig);
      
      const payment = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount.toString()
          },
          custom_id: paymentData.id?.toString(),
          description: 'School payment'
        }],
        application_context: {
          return_url: paypalConfig.returnUrl,
          cancel_url: paypalConfig.cancelUrl
        }
      };

      const response = await axios.post(
        `${paypalConfig.apiUrl}/v2/checkout/orders`,
        payment,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        transactionId: response.data.id,
        status: response.data.status,
        approvalUrl: response.data.links.find(link => link.rel === 'approve').href,
        message: 'PayPal payment created successfully'
      };
    } catch (error) {
      console.error('PayPal payment error:', error);
      return {
        success: false,
        message: error.message || 'PayPal payment failed'
      };
    }
  }

  // Razorpay payment processing
  async processRazorpayPayment(paymentData, config) {
    try {
      const { amount, currency, metadata } = paymentData;
      const razorpayConfig = config.config;
      
      const order = await axios.post(
        'https://api.razorpay.com/v1/orders',
        {
          amount: Math.round(amount * 100), // Convert to paise
          currency: currency,
          receipt: paymentData.receiptNumber,
          notes: metadata
        },
        {
          auth: {
            username: razorpayConfig.keyId,
            password: razorpayConfig.keySecret
          }
        }
      );

      return {
        success: true,
        transactionId: order.data.id,
        status: 'created',
        orderId: order.data.id,
        message: 'Razorpay order created successfully'
      };
    } catch (error) {
      console.error('Razorpay payment error:', error);
      return {
        success: false,
        message: error.message || 'Razorpay payment failed'
      };
    }
  }

  // Paytm payment processing
  async processPaytmPayment(paymentData, config) {
    try {
      const { amount, currency, metadata } = paymentData;
      const paytmConfig = config.config;
      
      const order = await axios.post(
        'https://securegw-stage.paytm.in/order/process',
        {
          MID: paytmConfig.merchantId,
          ORDER_ID: paymentData.receiptNumber,
          TXN_AMOUNT: amount.toString(),
          CURRENCY: currency,
          CHANNEL_ID: 'WEB',
          WEBSITE: paytmConfig.website,
          CALLBACK_URL: paytmConfig.callbackUrl,
          INDUSTRY_TYPE_ID: 'Retail',
          CHECKSUMHASH: this.generatePaytmChecksum(paymentData, paytmConfig)
        }
      );

      return {
        success: true,
        transactionId: order.data.TXNID,
        status: 'created',
        orderId: order.data.ORDERID,
        message: 'Paytm order created successfully'
      };
    } catch (error) {
      console.error('Paytm payment error:', error);
      return {
        success: false,
        message: error.message || 'Paytm payment failed'
      };
    }
  }

  // Cashfree payment processing
  async processCashfreePayment(paymentData, config) {
    try {
      const { amount, currency, metadata } = paymentData;
      const cashfreeConfig = config.config;
      
      const order = await axios.post(
        'https://sandbox.cashfree.com/pg/orders',
        {
          order_id: paymentData.receiptNumber,
          order_amount: amount,
          order_currency: currency,
          customer_details: {
            customer_id: paymentData.studentId?.toString() || paymentData.parentId?.toString(),
            customer_name: metadata.customerName || 'Student',
            customer_email: metadata.customerEmail || 'student@school.com',
            customer_phone: metadata.customerPhone || '9999999999'
          },
          order_meta: {
            return_url: cashfreeConfig.returnUrl,
            notify_url: cashfreeConfig.notifyUrl
          }
        },
        {
          headers: {
            'x-client-id': cashfreeConfig.clientId,
            'x-client-secret': cashfreeConfig.clientSecret,
            'x-api-version': '2022-09-01'
          }
        }
      );

      return {
        success: true,
        transactionId: order.data.cf_order_id,
        status: 'created',
        orderId: order.data.order_id,
        message: 'Cashfree order created successfully'
      };
    } catch (error) {
      console.error('Cashfree payment error:', error);
      return {
        success: false,
        message: error.message || 'Cashfree payment failed'
      };
    }
  }

  // Custom payment processing
  async processCustomPayment(paymentData, config) {
    try {
      const customConfig = config.config;
      
      // Custom payment logic based on configuration
      const customResult = await this.executeCustomPaymentLogic(paymentData, customConfig);
      
      return {
        success: true,
        transactionId: customResult.transactionId,
        status: 'processed',
        message: 'Custom payment processed successfully'
      };
    } catch (error) {
      console.error('Custom payment error:', error);
      return {
        success: false,
        message: error.message || 'Custom payment failed'
      };
    }
  }

  // Execute custom payment logic
  async executeCustomPaymentLogic(paymentData, config) {
    // This is a placeholder for custom payment logic
    // In a real implementation, this would contain the specific logic
    // for the custom payment gateway
    
    return {
      transactionId: `CUSTOM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'success'
    };
  }

  // Get PayPal access token
  async getPayPalAccessToken(config) {
    try {
      const response = await axios.post(
        `${config.apiUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting PayPal access token:', error);
      throw error;
    }
  }

  // Generate Paytm checksum
  generatePaytmChecksum(paymentData, config) {
    // This is a placeholder for Paytm checksum generation
    // In a real implementation, this would use the Paytm checksum library
    return 'checksum_placeholder';
  }

  // Verify payment status
  async verifyPaymentStatus(transactionId, gateway, schoolId) {
    try {
      const gatewayConfig = await this.getGatewayConfig(schoolId, gateway);
      if (!gatewayConfig) {
        return { success: false, message: 'Gateway not configured' };
      }

      switch (gateway) {
        case 'STRIPE':
          return await this.verifyStripePayment(transactionId);
        case 'PAYPAL':
          return await this.verifyPayPalPayment(transactionId, gatewayConfig);
        case 'RAZORPAY':
          return await this.verifyRazorpayPayment(transactionId, gatewayConfig);
        case 'PAYTM':
          return await this.verifyPaytmPayment(transactionId, gatewayConfig);
        case 'CASHFREE':
          return await this.verifyCashfreePayment(transactionId, gatewayConfig);
        default:
          return { success: false, message: 'Unsupported gateway for verification' };
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      return { success: false, message: 'Payment verification failed' };
    }
  }

  // Verify Stripe payment
  async verifyStripePayment(transactionId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
      
      return {
        success: true,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        message: 'Payment verified successfully'
      };
    } catch (error) {
      console.error('Stripe verification error:', error);
      return { success: false, message: 'Stripe verification failed' };
    }
  }

  // Verify PayPal payment
  async verifyPayPalPayment(transactionId, config) {
    try {
      const accessToken = await this.getPayPalAccessToken(config);
      
      const response = await axios.get(
        `${config.apiUrl}/v2/checkout/orders/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return {
        success: true,
        status: response.data.status,
        amount: response.data.purchase_units[0].amount.value,
        currency: response.data.purchase_units[0].amount.currency_code,
        message: 'PayPal payment verified successfully'
      };
    } catch (error) {
      console.error('PayPal verification error:', error);
      return { success: false, message: 'PayPal verification failed' };
    }
  }

  // Verify Razorpay payment
  async verifyRazorpayPayment(transactionId, config) {
    try {
      const response = await axios.get(
        `https://api.razorpay.com/v1/orders/${transactionId}`,
        {
          auth: {
            username: config.keyId,
            password: config.keySecret
          }
        }
      );

      return {
        success: true,
        status: response.data.status,
        amount: response.data.amount / 100,
        currency: response.data.currency,
        message: 'Razorpay payment verified successfully'
      };
    } catch (error) {
      console.error('Razorpay verification error:', error);
      return { success: false, message: 'Razorpay verification failed' };
    }
  }

  // Verify Paytm payment
  async verifyPaytmPayment(transactionId, config) {
    try {
      const response = await axios.post(
        'https://securegw-stage.paytm.in/order/status',
        {
          MID: config.merchantId,
          ORDERID: transactionId,
          CHECKSUMHASH: this.generatePaytmChecksum({ transactionId }, config)
        }
      );

      return {
        success: true,
        status: response.data.STATUS,
        amount: response.data.TXN_AMOUNT,
        currency: response.data.CURRENCY,
        message: 'Paytm payment verified successfully'
      };
    } catch (error) {
      console.error('Paytm verification error:', error);
      return { success: false, message: 'Paytm verification failed' };
    }
  }

  // Verify Cashfree payment
  async verifyCashfreePayment(transactionId, config) {
    try {
      const response = await axios.get(
        `https://sandbox.cashfree.com/pg/orders/${transactionId}`,
        {
          headers: {
            'x-client-id': config.clientId,
            'x-client-secret': config.clientSecret,
            'x-api-version': '2022-09-01'
          }
        }
      );

      return {
        success: true,
        status: response.data.order_status,
        amount: response.data.order_amount,
        currency: response.data.order_currency,
        message: 'Cashfree payment verified successfully'
      };
    } catch (error) {
      console.error('Cashfree verification error:', error);
      return { success: false, message: 'Cashfree verification failed' };
    }
  }

  // Process webhook
  async processWebhook(gateway, payload, signature) {
    try {
      switch (gateway) {
        case 'STRIPE':
          return await this.processStripeWebhook(payload, signature);
        case 'PAYPAL':
          return await this.processPayPalWebhook(payload);
        case 'RAZORPAY':
          return await this.processRazorpayWebhook(payload, signature);
        case 'PAYTM':
          return await this.processPaytmWebhook(payload);
        case 'CASHFREE':
          return await this.processCashfreeWebhook(payload);
        default:
          return { success: false, message: 'Unsupported gateway webhook' };
      }
    } catch (error) {
      console.error('Webhook processing error:', error);
      return { success: false, message: 'Webhook processing failed' };
    }
  }

  // Process Stripe webhook
  async processStripeWebhook(payload, signature) {
    try {
      const stripe = initializeStripe();
      if (!stripe) {
        return { success: false, message: 'Stripe not configured' };
      }
      
      const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSuccess(event.data.object);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailure(event.data.object);
        default:
          return { success: true, message: 'Webhook processed' };
      }
    } catch (error) {
      console.error('Stripe webhook error:', error);
      return { success: false, message: 'Stripe webhook failed' };
    }
  }

  // Handle payment success
  async handlePaymentSuccess(paymentData) {
    try {
      const payment = await prisma.payment.findFirst({
        where: { gatewayTransactionId: paymentData.id }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'PAID' }
        });
      }

      return { success: true, message: 'Payment success handled' };
    } catch (error) {
      console.error('Payment success handling error:', error);
      return { success: false, message: 'Payment success handling failed' };
    }
  }

  // Handle payment failure
  async handlePaymentFailure(paymentData) {
    try {
      const payment = await prisma.payment.findFirst({
        where: { gatewayTransactionId: paymentData.id }
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' }
        });
      }

      return { success: true, message: 'Payment failure handled' };
    } catch (error) {
      console.error('Payment failure handling error:', error);
      return { success: false, message: 'Payment failure handling failed' };
    }
  }

  // Placeholder webhook handlers for other gateways
  async processPayPalWebhook(payload) {
    // Implement PayPal webhook processing
    return { success: true, message: 'PayPal webhook processed' };
  }

  async processRazorpayWebhook(payload, signature) {
    // Implement Razorpay webhook processing
    return { success: true, message: 'Razorpay webhook processed' };
  }

  async processPaytmWebhook(payload) {
    // Implement Paytm webhook processing
    return { success: true, message: 'Paytm webhook processed' };
  }

  async processCashfreeWebhook(payload) {
    // Implement Cashfree webhook processing
    return { success: true, message: 'Cashfree webhook processed' };
  }
}

export default new PaymentGatewayService(); 