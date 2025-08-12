const express = require('express');
const { Pool } = require('pg');
const { resolveTenant } = require('./middleware');
const { GroqService } = require('./services/groq');
const { DeepgramService } = require('./services/deepgram');
const { ElevenLabsService } = require('./services/elevenlabs');
const { TelnyxService } = require('./services/telnyx');
const voiceRoutes = require('./routes/voice');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Voice webhook routes
app.use('/webhooks/telnyx/voice', voiceRoutes);

// Database with connection pooling
const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'SCA AI Secretary Platform is running!' });
});

// Test tenant route
app.post('/test-tenant', resolveTenant, (req, res) => {
    res.json({ 
        message: 'Tenant resolved successfully!',
        organization: req.org.name,
        business_type: req.org.business_type
    });
});

// Test AI route
app.post('/test-ai', resolveTenant, async (req, res) => {
    try {
        const groq = new GroqService();
        
        const messages = [
            { role: "user", content: "Hi, I need help with my broken refrigerator" }
        ];
        
        const response = await groq.chat(messages, req.org, 'en');
        
        res.json({
            message: 'AI response generated successfully!',
            organization: req.org.name,
            ai_response: response
        });
    } catch (error) {
        console.error('AI test error:', error);
        res.status(500).json({ error: 'AI service error' });
    }
});

// Test TTS route
app.post('/test-tts', resolveTenant, async (req, res) => {
    try {
        const elevenlabs = new ElevenLabsService();
        
        const text = "Hello! Thank you for calling SCA. How can I help you today?";
        const audioBuffer = await elevenlabs.generateSpeech(text, 'en');
        
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length
        });
        res.send(audioBuffer);
    } catch (error) {
        console.error('TTS test error:', error);
        res.status(500).json({ error: 'TTS service error' });
    }
});

// Provision phone number
app.post('/provision-number', async (req, res) => {
    try {
        const { areaCode } = req.body;
        const telnyx = new TelnyxService();
        
        console.log(`📞 Provisioning number for area code: ${areaCode || 'any'}`);
        
        const result = await telnyx.provisionNumber(areaCode);
        
        console.log(`✅ Number provisioned: ${result.phone_number}`);
        
        res.json({
            success: true,
            phone_number: result.phone_number,
            telnyx_id: result.telnyx_id,
            message: `SCA AI Secretary number ready: ${result.phone_number}`
        });
        
    } catch (error) {
        console.error('❌ Number provisioning error:', error);
        res.status(500).json({ 
            error: 'Failed to provision number',
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SCA AI Secretary Platform running on port ${PORT}`);
});

module.exports = { db };