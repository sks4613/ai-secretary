 const express = require('express');
const router = express.Router();
const { resolveTenant } = require('../middleware');
const { GroqService } = require('../services/groq');
const { ElevenLabsService } = require('../services/elevenlabs');
const { DeepgramService } = require('../services/deepgram');

// Store conversation sessions in memory (for production, use Redis)
const conversations = new Map();

// Handle incoming voice calls - COMPLETE AI CONVERSATION
router.post('/inbound', resolveTenant, async (req, res) => {
    try {
        const callSid = req.body.call_control_id || req.body.CallSid || 'test-call';
        const fromNumber = req.body.From || req.body.from;
        
        console.log(`📞 Incoming call for ${req.org.name} from ${fromNumber}`);
        
        // Initialize conversation session
        conversations.set(callSid, {
            orgId: req.org.id,
            orgContext: req.org,
            messages: [],
            language: 'en'
        });
        
        // Generate personalized AI greeting
        const groq = new GroqService();
        const greeting = await groq.chat([
            { role: "user", content: "Generate a brief professional greeting for someone calling SCA appliance repair" }
        ], req.org, 'en');
        
        // Convert greeting to speech
        const elevenlabs = new ElevenLabsService();
        const audioBuffer = await elevenlabs.generateSpeech(greeting, 'en');
        
        // TwiML response for complete conversation
        const response = `
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="alice">${greeting}</Say>
                <Record 
                    maxLength="30" 
                    finishOnKey="#" 
                    action="${process.env.BASE_URL}/webhooks/telnyx/voice/process-speech"
                    playBeep="false"
                    timeout="3"
                />
            </Response>
        `;
        
        res.type('text/xml').send(response);
        
    } catch (error) {
        console.error('❌ Voice webhook error:', error);
        
        // Fallback response
        const fallbackResponse = `
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="alice">
                    Hello! Thank you for calling SCA. 
                    How can I help with your appliance needs today?
                </Say>
                <Record maxLength="30" finishOnKey="#" playBeep="false"/>
            </Response>
        `;
        res.type('text/xml').send(fallbackResponse);
    }
});

// Process customer speech and respond with AI
router.post('/process-speech', async (req, res) => {
    try {
        const callSid = req.body.call_control_id || req.body.CallSid;
        const recordingUrl = req.body.RecordingUrl || req.body.recording_url;
        
        const conversation = conversations.get(callSid);
        if (!conversation) {
            throw new Error('Conversation session not found');
        }
        
        console.log(`🎤 Processing speech for call ${callSid}`);
        
        // Convert speech to text
        const deepgram = new DeepgramService();
        const transcription = await deepgram.transcribeAudio(recordingUrl, conversation.language);
        
        console.log(`💬 Customer said: "${transcription.transcript}"`);
        
        // Add to conversation history
        conversation.messages.push({
            role: "user", 
            content: transcription.transcript
        });
        
        // Generate AI response
        const groq = new GroqService();
        const aiResponse = await groq.chat(conversation.messages, conversation.orgContext, transcription.language);
        
        console.log(`🤖 AI responds: "${aiResponse}"`);
        
        // Add AI response to conversation
        conversation.messages.push({
            role: "assistant",
            content: aiResponse
        });
        
        // Check if customer wants to end call or transfer
        const shouldTransfer = aiResponse.toLowerCase().includes('transfer') || 
                              aiResponse.toLowerCase().includes('human') ||
                              transcription.transcript.toLowerCase().includes('talk to someone');
        
        if (shouldTransfer) {
            const response = `
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say voice="alice">${aiResponse}</Say>
                    <Say voice="alice">Please hold while I transfer you to our team.</Say>
                    <Dial>${process.env.TRANSFER_NUMBER || '+1234567890'}</Dial>
                </Response>
            `;
            res.type('text/xml').send(response);
        } else {
            // Continue conversation
            const response = `
                <?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say voice="alice">${aiResponse}</Say>
                    <Record 
                        maxLength="30" 
                        finishOnKey="#" 
                        action="${process.env.BASE_URL}/webhooks/telnyx/voice/process-speech"
                        playBeep="false"
                        timeout="5"
                    />
                </Response>
            `;
            res.type('text/xml').send(response);
        }
        
    } catch (error) {
        console.error('❌ Speech processing error:', error);
        
        const errorResponse = `
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="alice">
                    I'm sorry, I didn't catch that. Could you please repeat your question?
                </Say>
                <Record maxLength="30" finishOnKey="#" playBeep="false"/>
            </Response>
        `;
        res.type('text/xml').send(errorResponse);
    }
});

// Handle call completion
router.post('/completed', async (req, res) => {
    try {
        const callSid = req.body.call_control_id || req.body.CallSid;
        
        // Clean up conversation session
        if (conversations.has(callSid)) {
            console.log(`📞 Call ${callSid} completed`);
            conversations.delete(callSid);
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Call completion error:', error);
        res.sendStatus(200);
    }
});

module.exports = router;