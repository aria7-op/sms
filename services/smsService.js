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
        return this.token;
      }

      console.log('🔐 Getting new SMS authentication token...');
      
      const response = await axios.post(`${this.baseUrl}/api/AuthJwt/Authenticate`, {
        Username: this.username,
        Password: this.password
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        this.lastTokenDate = today;
        console.log('✅ SMS authentication token obtained successfully');
        return this.token;
      } else {
        throw new Error('Invalid response from SMS authentication service');
      }
    } catch (error) {
      console.error('❌ Failed to get SMS authentication token:', error.message);
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
              Msisdn: studentData.phone || '',
              VAR1: studentData.name || 'Student',
              VAR2: timeInfo,
              VAR3: attendanceData.date || new Date().toDateString(),
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

      const response = await axios.post(
        `${this.baseUrl}/campaignApi/InsertBulkSms/${masterCampaignId}`,
        smsPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
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
      console.error('❌ Failed to send SMS:', error.message);
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
}

export default new SMSService(); 
