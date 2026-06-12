import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({});

export const aiAnalysisService = {
  analyze: async (localFilePath, userPrompt) => {
    let uploadedFile = null;

    try {
      console.log(
        "[Gemini API] Uploading audio track to Google GenAI storage...",
      );

      uploadedFile = await ai.files.upload({
        file: localFilePath,
        config: { mimeType: "audio/mp3" },
      });

      console.log(
        `[Gemini API] Audio uploaded successfully. URI: ${uploadedFile.uri}`,
      );

      const instructions = `
        You are a professional video editor. Listen to the provided audio track.
        Based on the user's request: "${userPrompt}", find the best moments.
        You must return an exact JSON array of objects. 
        Each object must have a 'start' and 'end' key (numbers in seconds).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: uploadedFile.uri,
                  mimeType: uploadedFile.mimeType,
                },
              },
              { text: instructions },
            ],
          },
        ],
        config: {
          responseFormat: { type: "application/json" },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              highlights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.NUMBER },
                    end: { type: Type.NUMBER },
                  },
                  required: ["start", "end"],
                },
              },
            },
            required: ["highlights"],
          },
        },
      });

      // 1. Strip markdown code blocks
      const rawText = response.text;
      const cleanedText = rawText
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

      // 2. Parse the JSON
      const resultJson = JSON.parse(cleanedText);
      console.log("[Gemini API] Raw parsed object:", resultJson);

      // 3. Handle structure (supports both object wrapper or raw array)
      const finalHighlights = Array.isArray(resultJson)
        ? resultJson
        : resultJson.highlights || [];

      if (!finalHighlights || finalHighlights.length === 0) {
        console.warn("[Gemini API] Warning: No highlights were extracted.");
        return [];
      }

      return finalHighlights;
    } catch (error) {
      console.error("[Gemini API] Analysis failed:", error);
      throw new Error(`AI Analysis Error: ${error.message}`);
    } finally {
      if (uploadedFile) {
        try {
          await ai.files.delete({ name: uploadedFile.name });
          console.log(
            `[Gemini API] Cleaned up remote file: ${uploadedFile.name}`,
          );
        } catch (cleanupError) {
          console.error(
            "[Gemini API] Failed to clean up remote file:",
            cleanupError.message,
          );
        }
      }
    }
  },
};
