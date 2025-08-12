const axios = require('axios');

class GroqService {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.baseURL = 'https://api.groq.com/openai/v1';
    }
    
    async chat(messages, orgContext, language = 'en') {
        try {
            const systemPrompt = this.buildSystemPrompt(orgContext, language);
            
            const response = await axios.post(`${this.baseURL}/chat/completions`, {
                model: "llama3-70b-8192",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages
                ],
                temperature: 0.7,
                max_tokens: 500
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Groq API error:', error);
            throw error;
        }
    }
    
    buildSystemPrompt(orgContext, language) {
        return `You are an AI secretary for ${orgContext.name}, a ${orgContext.business_type} business.

PERSONALITY: professional, helpful, friendly
BUSINESS HOURS: Monday-Friday 9AM-5PM, Saturday 10AM-2PM, Sunday closed
SERVICES: appliance repair, installation, maintenance, consultation

LANGUAGE INSTRUCTIONS:
- Primary language: ${language}
- Always respond in the same language the customer uses
- If customer switches languages, switch with them

YOUR ROLE:
1. Answer phone professionally: "Hi! Thank you for calling ${orgContext.name}. I'm your AI assistant. How can I help with your appliance needs today?"
2. Help schedule appointments by asking: What type of appliance? What's the problem? When works best? Your address?
3. Answer basic questions about services and hours
4. Transfer to human if requested or for complex issues

Keep responses concise, helpful, and professional. Always confirm important details back to the customer.`;
    }
}

module.exports = { GroqService };