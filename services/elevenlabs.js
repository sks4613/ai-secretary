require('dotenv').config();
const axios = require('axios');

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.baseURL = 'https://api.elevenlabs.io/v1';
        
        // Voice IDs for different languages
        this.voices = {
            en: 'EXAVITQu4vr4xnSDxMaL', // Bella - English
            es: 'VR6AewLTigWG4xSOukaG', // Sofia - Spanish  
            zh: 'yoZ06aMxZJJ28mfd3POQ', // Lin - Chinese
            vi: 'bVMeCyTHy58xNoL34h3p', // An - Vietnamese
            ko: 'g5CIjZEefAph4nQFvHAz'  // Min - Korean
        };
    }
    
    async generateSpeech(text, language = 'en', voiceId = null) {
        try {
            const selectedVoiceId = voiceId || this.voices[language] || this.voices.en;
            
            const response = await axios.post(
                `${this.baseURL}/text-to-speech/${selectedVoiceId}`,
                {
                    text: text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    }
                },
                {
                    headers: {
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer'
                }
            );
            
            return Buffer.from(response.data);
        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            throw error;
        }
    }
}

module.exports = { ElevenLabsService };