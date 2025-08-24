 // server.js
const axios = require('axios'); const express = require('express');
const { Pool } = require('pg');
const { resolveTenant } = require('./middleware');
const { GroqService } = require('./services/groq');
const { DeepgramService } = require('./services/deepgram');
const { ElevenLabsService } = require('./services/elevenlabs');
const { DatabaseInitializer } = require('./database-init');
// If you later want to use the router-based flow, uncomment the next line
// const voiceRoutes = require('./routes/voice');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// If you switch to the router-based XML flow, uncomment this and REMOVE the inline handler below
// app.use('/webhooks/telnyx/voice', voiceRoutes);

// ----- Database (DATABASE_URL only) -----
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ----- Initialize DB on boot (safe if already initialized) -----
async function initializeApp() {
  try {
    console.log('🔧 Initializing SCA Appliance Liquidations...');
    const dbInit = new DatabaseInitializer();
    await dbInit.initializeDatabase();
    await dbInit.close();
    console.log('✅ SCA Appliance Liquidations database ready!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // continue; tables may already exist
  }
}
initializeApp();

// ----- Health -----
app.get('/', (req, res) => {
  res.json({ message: 'SCA Appliance Liquidations AI Secretary Platform is running!' });
});

// ----- Test tenant resolution -----
app.post('/test-tenant', resolveTenant, (req, res) => {
  res.json({
    message: 'Tenant resolved successfully!',
    organization: req.org.name,
    business_type: req.org.business_type,
  });
});

// ----- Test AI (Groq) -----
app.post('/test-ai', resolveTenant, async (req, res) => {
  try {
    const groq = new GroqService();
    const messages = [{ role: 'user', content: 'Hi, I need help finding a new refrigerator' }];
    const response = await groq.chat(messages, req.org, 'en');
    res.json({
      message: 'AI response generated successfully!',
      organization: req.org.name,
      ai_response: response,
    });
  } catch (error) {
    console.error('AI test error:', error);
    res.status(500).json({ error: 'AI service error' });
  }
});

// ----- Test TTS (ElevenLabs) -----
app.post('/test-tts', resolveTenant, async (req, res) => {
  try {
    const elevenlabs = new ElevenLabsService();
    const text = 'Thank you for calling SCA Appliance Liquidations. How may I help you today?';
    const audioBuffer = await elevenlabs.generateSpeech(text, 'en');
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error('TTS test error:', error);
    res.status(500).json({ error: 'TTS service error' });
  }
});

// GET version for quick browser test
app.get('/test-tts', async (req, res) => {
  try {
    const elevenlabs = new ElevenLabsService();
    const text = 'Hello! Thank you for calling SCA Appliance Liquidations. How can I help you today?';
    const audioBuffer = await elevenlabs.generateSpeech(text, 'en');
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error('TTS test error:', error);
    res.status(500).json({ error: 'TTS service error' });
  }
});

// ====================================================================
// INLINE TELNYX HANDLER (API v2-compatible JSON command responses)
// NOTE: This path must be unique (do NOT also mount the router to it).
// ====================================================================
app.post('/webhooks/telnyx/voice/inbound', async (req, res) => {
  try {
    console.log('📞 Telnyx webhook received:', JSON.stringify(req.body, null, 2));

    // Telnyx v2 places fields at top-level and details under payload.*
    const event_type = req.body.event_type || req.body.data?.event_type;
    const call_control_id =
      req.body.payload?.call_control_id || req.body.data?.payload?.call_control_id;

    console.log(`📞 Event: ${event_type} | call_control_id: ${call_control_id}`);

    if (!event_type || !call_control_id) {
      console.log('⚠️ Missing event_type or call_control_id; acknowledging without command.');
      return res.status(200).json({ status: 'ok' });
    }

    // v2 event names are snake_case (e.g., call_initiated, call_answered)
if (event_type === 'call_initiated') {
  console.log('📞 Answering call via Telnyx v2 REST');
  try {
    const { status, data } = await axios.post(
      `https://api.telnyx.com/v2/calls/${call_control_id}/actions/answer`,
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: 5000
      }
    );
    console.log('✅ Telnyx answer status:', status, JSON.stringify(data));
  } catch (err) {
    console.error(
      '❌ Telnyx answer error:',
      err.response?.status,
      JSON.stringify(err.response?.data || {}),
      '| message:', err.message
    );
  }
  return res.status(200).json({ status: 'ok' });
}

    if (event_type === 'call_answered') {
  console.log('🗣️ Speaking greeting via Telnyx v2 REST');
  await axios.post(
    `https://api.telnyx.com/v2/calls/${call_control_id}/actions/speak`,
    {
      payload:
        'SCA Appliance Liquidations. How can I help you?',
      voice: 'male'
    },
    { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` } }
  );
  return res.status(200).json({ status: 'ok' });
}


    if (event_type === 'call_speak_ended') {
  console.log('🛑 Hanging up via Telnyx v2 REST');
  await axios.post(
    `https://api.telnyx.com/v2/calls/${call_control_id}/actions/hangup`,
    {},
    { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` } }
  );
  return res.status(200).json({ status: 'ok' });
}

    console.log(`ℹ️ Unhandled event: ${event_type}`);
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Telnyx handler error:', error);
    return res.status(200).json({ status: 'error' });
  }
});

// ----- Debug catch-all for any webhook paths -----
app.all('/webhooks/*', (req, res) => {
  console.log('🔍 WEBHOOK DEBUG - URL:', req.url, 'Method:', req.method, 'Body:', req.body);
  res.status(200).json({ debug: 'webhook received' });
});

// ----- Start -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SCA Appliance Liquidations AI Secretary Platform running on port ${PORT}`);
});

module.exports = { db };
