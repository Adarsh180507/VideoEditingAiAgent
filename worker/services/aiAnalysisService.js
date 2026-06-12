import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Google GenAI SDK
// It automatically picks up the GEMINI_API_KEY from your .env file
const ai = new GoogleGenAI({});

export const aiAnalysisService = {
    /**
     * Uploads an audio file to Gemini and requests structural timestamp highlights.
     * @param {string} localFilePath - Path to the extracted MP3 file.
     * @param {string} userPrompt - Context provided by the user (e.g., "Find funny moments").
     * @returns {Promise<Object>} - A parsed JSON object containing the highlight timestamps.
     */
    analyze: async (localFilePath, userPrompt) => {
        let uploadedFile = null;

        try {
            console.log('[Gemini API] Uploading audio track to Google GenAI storage...');
            
            // 1. Upload the heavy file to Gemini's File API first
            uploadedFile = await ai.files.upload({
                file: localFilePath,
                config: { mimeType: 'audio/mp3' }
            });

            console.log(`[Gemini API] Audio uploaded successfully. URI: ${uploadedFile.uri}`);
            console.log('[Gemini API] Initiating audio analysis...');

            // 2. Build the system prompt to enforce our exact JSON schema requirement
            const instructions = `
                You are a professional video editor. Listen to the provided audio track.
                Based on the user's request: "${userPrompt}", find the best moments.
                You must return an exact JSON array of objects. 
                Each object must have a 'start' and 'end' key representing the timestamps in seconds.
            `;

            // 3. Ask Gemini 2.5 Flash to analyze the audio and return structured JSON
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { fileData: { fileUri: uploadedFile.uri, mimeType: uploadedFile.mimeType } },
                            { text: instructions }
                        ]
                    }
                ],
                config: {
                    // Force the AI to only reply in JSON matching this exact schema
                    responseFormat: { type: 'application/json' },
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            highlights: {
                                type: Type.ARRAY,
                                description: "List of highlight segments",
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        start: { type: Type.NUMBER, description: "Start time in seconds" },
                                        end: { type: Type.NUMBER, description: "End time in seconds" }
                                    },
                                    required: ["start", "end"]
                                }
                            }
                        },
                        required: ["highlights"]
                    }
                }
            });

            console.log('[Gemini API] Analysis complete. Parsing response...');
            
            // The response is guaranteed to be JSON because of our config constraints
            const resultJson = JSON.parse(response.text);
            return resultJson.highlights;

        } catch (error) {
            console.error('[Gemini API] Analysis failed:', error);
            throw new Error(`AI Analysis Error: ${error.message}`);
        } finally {
            // 4. Production cleanup: Always delete the file from Google's servers to prevent quota limits
            if (uploadedFile) {
                try {
                    await ai.files.delete({ name: uploadedFile.name });
                    console.log(`[Gemini API] Cleaned up remote file: ${uploadedFile.name}`);
                } catch (cleanupError) {
                    console.error('[Gemini API] Failed to clean up remote file:', cleanupError.message);
                }
            }
        }
    }
};