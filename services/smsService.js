import axios from 'axios';

class SMSService {
  constructor() {
    this.baseUrl = 'https://dservices.etisalat.af/smsbusinesssolution';
    this.username = '730774777';
    this.password = 'Kawish#1234';
    this.token = null;
    this.lastTokenDate = null;
    // Campaign IDs: 403 for in-time, 404 for out-time
    this.campaignIds = {
      inTime: '403',
      outTime: '404'
    };
  }

  /**
   * Get authentication token (once per day)
   */
  async getAuthToken() {
    try {
      const today = new Date().toDateString();
      
      // Check if we already have a valid token for today
      if (this.token && this.lastTokenDate === today) {
        console.log('🔐 Using existing SMS token from today');
        return this.token;
      }

      console.log('🔐 Getting new SMS authentication token...');
      console.log('🔐 Base URL:', this.baseUrl);
      console.log('🔐 Username:', this.username);
      console.log('🔐 Password:', this.password ? '***' : 'NOT SET');
      
      const authPayload = {
        Username: this.username,
        Password: this.password
      };
      
      console.log('🔐 Auth payload:', authPayload);
      console.log('🔐 Making POST request to:', `${this.baseUrl}/api/AuthJwt/Authenticate`);
      
      const response = await axios.post(`${this.baseUrl}/api/AuthJwt/Authenticate`, authPayload, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('🔐 Response received:');
      console.log('🔐 Status:', response.status);
      console.log('🔐 Status Text:', response.statusText);
      console.log('🔐 Headers:', response.headers);
      console.log('🔐 Response Data:', response.data);
      console.log('🔐 Response Data Type:', typeof response.data);
      console.log('🔐 Response Data Keys:', response.data ? Object.keys(response.data) : 'No data');

      // Handle case where response.data is the token string directly
      if (typeof response.data === 'string' && response.data.startsWith('eyJ')) {
        // Direct JWT token response
        this.token = response.data;
        this.lastTokenDate = today;
        console.log('✅ SMS authentication token obtained successfully (direct JWT)');
        console.log('✅ Token:', this.token);
        return this.token;
      } else if (response.data && response.data.token) {
        this.token = response.data.token;
        this.lastTokenDate = today;
        console.log('✅ SMS authentication token obtained successfully');
        console.log('✅ Token:', this.token);
        return this.token;
      } else if (response.data && response.data.access_token) {
        // Handle alternative token field name
        this.token = response.data.access_token;
        this.lastTokenDate = today;
        console.log('✅ SMS authentication token obtained successfully (access_token)');
        console.log('✅ Token:', this.token);
        return this.token;
      } else if (response.data && response.data.jwt) {
        // Handle JWT field name
        this.token = response.data.jwt;
        this.lastTokenDate = today;
        console.log('✅ SMS authentication token obtained successfully (jwt)');
        console.log('✅ Token:', this.token);
        return this.token;
      } else {
        console.log('❌ Response data structure:', response.data);
        throw new Error(`Invalid response structure. Expected JWT string or 'token', 'access_token', or 'jwt' field. Got: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error('❌ Failed to get SMS authentication token:');
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error headers:', error.response?.headers);
      console.error('❌ Full error:', error);
      throw error;
    }
  }

  /**
   * Send SMS notification for student attendance
   */
  async sendAttendanceSMS(studentData, attendanceData, campaignType = 'inTime') {
    try {
      // Get fresh token if needed
      const token = await this.getAuthToken();

      // Get the appropriate campaign ID based on type
      const masterCampaignId = this.campaignIds[campaignType] || this.campaignIds.inTime;

      // Determine message type and content
      let messageType, timeInfo;
      if (attendanceData.inTime) {
        messageType = 'ARRIVAL';
        timeInfo = `Marked in at ${this.formatTime(attendanceData.inTime)}`;
      } else if (attendanceData.outTime) {
        messageType = 'DEPARTURE';
        timeInfo = `Marked out at ${this.formatTime(attendanceData.outTime)}`;
      } else {
        messageType = 'ATTENDANCE';
        timeInfo = 'Attendance recorded';
      }

      // Prepare SMS payload
      const smsPayload = [
        {
          RequestID: this.generateRequestId(),
          MasterCampaignID: masterCampaignId,
          BulkData: [
            {
              Msisdn: (studentData.phone || '').replace('+', ''), // Remove + prefix
              VAR1: studentData.name || 'Student',
              VAR2: timeInfo,
              VAR3: attendanceData.date ? new Date(attendanceData.date).toDateString() : new Date().toDateString(),
              VAR4: attendanceData.className || 'Class',
              VAR5: attendanceData.status || 'PRESENT',
              VAR6: 'Attendance System',
              VAR7: messageType,
              VAR8: '',
              VAR9: '',
              VAR10: ''
            }
          ]
        }
      ];

      console.log('📱 Sending SMS notification...', {
        student: studentData.name,
        phone: studentData.phone,
        messageType: messageType,
        time: attendanceData.inTime || attendanceData.outTime
      });

      console.log('📱 SMS API Request Details:');
      console.log('📱 URL:', `${this.baseUrl}/campaignApi/InsertBulkSms/${masterCampaignId}`);
      console.log('📱 Token:', token);
      console.log('📱 Payload:', JSON.stringify(smsPayload, null, 2));

      // Try different authorization header formats
      const headers = {
        'Content-Type': 'application/json'
      };

      // Try different auth header formats
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        // Alternative formats if the first one doesn't work
        headers['X-Auth-Token'] = token;
        headers['X-API-Key'] = token;
      }

      console.log('📱 Request Headers:', headers);

      const response = await axios.post(
        `${this.baseUrl}/campaignApi/InsertBulkSms/${masterCampaignId}`,
        smsPayload,
        { headers }
      );

      // Log detailed SMS response
      console.log('📱 SMS API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        campaignId: masterCampaignId,
        student: studentData.name,
        phone: studentData.phone
      });

      // Check if SMS was successful
      if (response.status === 200 || response.status === 201) {
        console.log('✅ SMS sent successfully!');
        return {
          success: true,
          data: response.data,
          campaignId: masterCampaignId
        };
      } else {
        console.log('⚠️ SMS sent but with unexpected status:', response.status);
        return {
          success: true,
          data: response.data,
          campaignId: masterCampaignId,
          warning: `Unexpected status: ${response.status}`
        };
      }

    } catch (error) {
      console.error('❌ Failed to send SMS:');
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
        console.error('❌ Response headers:', error.response.headers);
      }
      console.error('❌ Full error:', error);
      // Don't throw error - SMS failure shouldn't break attendance marking
      return null;
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return Date.now().toString();
  }

  /**
   * Format time for SMS
   */
  formatTime(dateTime) {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  /**
   * Check SMS delivery status (if the API supports it)
   */
  async checkSMSStatus(requestId) {
    try {
      const token = await this.getAuthToken();
      
      // This endpoint might vary based on Etisalat's API
      const response = await axios.get(
        `${this.baseUrl}/campaignApi/GetSMSStatus/${requestId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📱 SMS Status Check Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to check SMS status:', error.message);
      return null;
    }
  }
}

export default new SMSService(); 
