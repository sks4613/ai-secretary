 const express = require('express');
const { Pool } = require('pg');
const { resolveTenant } = require('./middleware');
const { GroqService } = require('./services/groq');
const { DeepgramService } = require('./services/deepgram');
const { ElevenLabsService } = require('./services/elevenlabs');
const { TelnyxService } = require('./services/telnyx');
const { DatabaseInitializer } = require('./database-init');
const voiceRoutes = require('./routes/voice');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Voice webhook routes
// app.use('/webhooks/telnyx/voice', voiceRoutes);

// Database with connection pooling - FIXED: Use only DATABASE_URL
const db = new Pool({
   connectionString: process.env.DATABASE_URL,
   ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
   max: 20,
   idleTimeoutMillis: 30000,
   connectionTimeoutMillis: 2000,
});

// Initialize database on startup
async function initializeApp() {
   try {
       console.log('🔧 Initializing SCA Appliance Liquidations...');
       const dbInit = new DatabaseInitializer();
       await dbInit.initializeDatabase();
       await dbInit.close();
       console.log('✅ SCA Appliance Liquidations database ready!');
   } catch (error) {
       console.error('❌ Database initialization failed:', error);
       // Continue anyway - might already be initialized
   }
}

// Initialize database when server starts
initializeApp();

// Test route
app.get('/', (req, res) => {
   res.json({ message: 'SCA Appliance Liquidations AI Secretary Platform is running!' });
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
           { role: "user", content: "Hi, I need help finding a new refrigerator" }
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
       
       const text = "Thank you for calling SCA Appliance Liquidations. How may I help you today?";
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

// GET version for browser testing
app.get('/test-tts', async (req, res) => {
   try {
       const elevenlabs = new ElevenLabsService();
       
       const text = "Hello! Thank you for calling SCA Appliance Liquidations. How can I help you today?";
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

// FIXED: Proper Telnyx Call Control webhook handler
app.post('/webhooks/telnyx/voice/inbound', async (req, res) => {
   try {
       console.log('📞 SIMPLE Telnyx webhook received:', JSON.stringify(req.body, null, 2));
       
       const { data } = req.body;
       const { event_type, call_control_id } = data || {};
       
       console.log(`📞 Event: ${event_type}`);
       
       if (event_type === 'call.initiated') {
           console.log('📞 Call initiated, sending answer command');
           return res.status(200).json({ 
               "command": "answer",
               "call_control_id": call_control_id
           });
       } else if (event_type === 'call.answered') {
           console.log('📞 Call answered, sending speak command');
           return res.status(200).json({ 
               "command": "speak",
               "call_control_id": call_control_id,
               "text": "Hello! Thank you for calling SCA Appliance Liquidations. We sell brand new appliances with full warranty at 50% below retail price.  Please call back later or leave a message after the beep.",
               "voice": "male"
           });
       } else if (event_type === 'call.speak.ended') {
           console.log('📞 Speak ended, hanging up');
           return res.status(200).json({
               "command": "hangup",
               "call_control_id": call_control_id
           });
       }
       
       console.log(`📞 Unhandled event: ${event_type}`);
       res.status(200).json({ status: 'ok' });
   } catch (error) {
       console.error('❌ Simple webhook error:', error);
       res.status(200).json({ status: 'error' });
   }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
   console.log(`SCA Appliance Liquidations AI Secretary Platform running on port ${PORT}`);
});

app.all('/webhooks/*', (req, res) => {
   console.log('🔍 WEBHOOK DEBUG - URL:', req.url, 'Method:', req.method, 'Body:', req.body);
   res.status(200).json({ debug: 'webhook received' });
});

module.exports = { db };