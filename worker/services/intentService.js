import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({});

export const intentService = {
  analyzeIntent: async (userPrompt) => {
    try {
      console.log(`[Intent Router] Analyzing prompt: "${userPrompt}"`);

      const instructions = `
        You are an intelligent routing agent for a video editing pipeline.
        Read the user's request: "${userPrompt}".
        
        Determine the exact editing intent:
        - "structural_edit": The user provided times, durations, or simple commands (e.g., "first 2 seconds", "trim the first 10s", "cut from 0:15 to 0:30").
        - "semantic_search": The user asked to find a specific moment, vibe, or event (e.g., "find the funniest part", "show me where they jump").
        
        CRITICAL RULES FOR 'structural_edit':
        If the intent is 'structural_edit', you MUST calculate the exact start and end times in seconds and place them in the 'highlights' array. 
        Example: "first 2 seconds" -> highlights: [{"start": 0, "end": 2}].
        Example: "trim the first 5 seconds" -> highlights: [{"start": 0, "end": 5}].
        If you select 'structural_edit', the highlights array CANNOT be empty.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // We use Flash because it is incredibly fast for text
        contents: instructions,
        config: {
          responseFormat: { type: "application/json" },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                enum: ["structural_edit", "semantic_search"],
                description: "The classification of the user's request.",
              },
              highlights: {
                type: Type.ARRAY,
                description:
                  "Only fill this out if intent is structural_edit. Convert the user's requested times to exact seconds.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.NUMBER },
                    end: { type: Type.NUMBER },
                  },
                  required: ["start", "end"],
                },
              },
              insights: {
                type: Type.STRING,
                description:
                  "A brief, conversational confirmation. E.g., 'I saw your exact timestamps, so I fast-tracked the edit!'",
              },
            },
            required: ["intent"],
          },
        },
      });

      const rawText = response.text
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      const resultJson = JSON.parse(rawText);

      console.log(`[Intent Router] Decision: ${resultJson.intent}`);
      return resultJson;
    } catch (error) {
      console.error(
        "[Intent Router] Router failed, defaulting to semantic search:",
        error.message,
      );
      // Failsafe: If the text router crashes, default to the heavy audio analysis just in case.
      return { intent: "semantic_search" };
    }
  },
};
