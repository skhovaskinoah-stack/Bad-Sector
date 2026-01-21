
import { GoogleGenAI } from "@google/genai";

// Use process.env.API_KEY directly as per guidelines.
export const generateLore = async (prompt: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });

    // Access .text property directly as per guidelines.
    return response.text || "No response from AI.";
  } catch (error) {
    console.error("Lore generation failed:", error);
    return "The system encountered a fatal error during extraction.";
  }
};
