require('dotenv').config();
const { createClient } = require('@deepgram/sdk');

class DeepgramService {
    constructor() {
        this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    }
    
    async transcribeAudio(audioUrl, language = 'en') {
        try {
            const { result, error } = await this.deepgram.listen.prerecorded.transcribeUrl(
                {
                    url: audioUrl
                },
                {
                    model: 'nova-2',
                    language: language,
                    smart_format: true,
                    punctuate: true,
                    detect_language: true
                }
            );

            if (error) {
                throw error;
            }
            
            const transcript = result.results.channels[0].alternatives[0].transcript;
            const detectedLanguage = result.results.channels[0].detected_language || language;
            
            return {
                transcript,
                language: detectedLanguage,
                confidence: result.results.channels[0].alternatives[0].confidence
            };
        } catch (error) {
            console.error('Deepgram transcription error:', error);
            throw error;
        }
    }
}

module.exports = { DeepgramService };