require('dotenv').config();

class TelnyxService {
    constructor() {
        this.client = null;
        this.initTelnyx();
    }
    
    async initTelnyx() {
        try {
            const telnyxModule = await import('telnyx');
            this.client = telnyxModule.default(process.env.TELNYX_API_KEY);
        } catch (error) {
            console.error('Failed to initialize Telnyx:', error);
        }
    }
    
    async provisionNumber(areaCode = null) {
        try {
            if (!this.client) {
                await this.initTelnyx();
            }
            
            // Search for available numbers
            const searchParams = {
                filter: {
                    country_code: 'US',
                    phone_number_type: 'local',
                    features: ['voice', 'sms']
                },
                limit: 5
            };
            
            if (areaCode) {
                searchParams.filter.national_destination_code = areaCode;
            }
            
            const availableNumbers = await this.client.availablePhoneNumbers.list(searchParams);
            
            if (!availableNumbers.data.length) {
                throw new Error('No available numbers found');
            }
            
            // Purchase the first available number
            const selectedNumber = availableNumbers.data[0];
            const purchasedNumber = await this.client.phoneNumbers.create({
                phone_number: selectedNumber.phone_number,
                voice_settings: {
                    webhook_url: `${process.env.BASE_URL}/webhooks/telnyx/voice/inbound`,
                    webhook_failover_url: `${process.env.BASE_URL}/webhooks/telnyx/voice/inbound`
                },
                messaging_settings: {
                    webhook_url: `${process.env.BASE_URL}/webhooks/telnyx/sms`
                }
            });
            
            return {
                phone_number: purchasedNumber.phone_number,
                telnyx_id: purchasedNumber.id
            };
            
        } catch (error) {
            console.error('Failed to provision number:', error);
            throw error;
        }
    }
    
    async makeCall(to, from) {
        try {
            if (!this.client) {
                await this.initTelnyx();
            }
            
            const call = await this.client.calls.create({
                to: to,
                from: from
            });
            
            return call;
        } catch (error) {
            console.error('Failed to make call:', error);
            throw error;
        }
    }
}

module.exports = { TelnyxService };