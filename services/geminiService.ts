import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize Gemini Client
// Note: process.env.API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface BilingualText {
  en: string;
  zh: string;
}

// Scientific Phenotype Interface
export interface AnalysisResult {
  morphology: BilingualText;       // e.g., "Globular", "Ellipsoid"
  textureType: BilingualText;      // e.g., "Reticulate", "Verrucose", "Sulcate"
  rugosityIndex: number;           // 1-10: Surface roughness/complexity
  ridgeContinuity: number;         // 1-10: 1=Highly Fragmented, 10=Continuous/Labyrinthine
  visualDepthScore: number;        // 1-10: Perceived depth of grooves
  phenotypicDescription: BilingualText; // Detailed scientific observation
}

export const analyzeWalnutImage = async (base64Image: string): Promise<AnalysisResult> => {
  try {
    const model = 'gemini-2.5-flash-image';
    
    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const prompt = `
      You are an expert Botanist specializing in Plant Phenomics (Phenotyping), specifically for the genus *Juglans* (Walnuts) and *Canarium* (Olive pits).
      
      Your task is to analyze the surface texture (rugosity) of the provided specimen image to extract quantitative phenotypic traits for genomic association studies.
      
      Ignore any cultural value or market appraisal. Focus PURELY on biological morphology.

      Analyze the following traits:
      1. **Morphology**: Overall shape (Globular, Ellipsoid, Cordate, etc.).
      2. **Texture Type**: Scientific classification of the surface pattern (e.g., Reticulate (net-like), Verrucose (warty), Sulcate (furrowed)).
      3. **Rugosity Index (1-10)**: A score representing the complexity and roughness of the surface. 1 is smooth, 10 is extremely convoluted.
      4. **Ridge Continuity (1-10)**: A score representing how continuous the ridges are. 1 = Highly fragmented (dots/islands), 10 = Highly continuous (long, labyrinth-like ridges).
      5. **Visual Depth Score (1-10)**: A visual estimation of the depth of the grooves relative to the ridges.

      Return the response in strict JSON format. 
      For text fields ('morphology', 'textureType', 'phenotypicDescription'), provide both "en" and "zh" translations.

      Structure:
      {
        "morphology": { "en": "...", "zh": "..." },
        "textureType": { "en": "...", "zh": "..." },
        "rugosityIndex": 7,
        "ridgeContinuity": 4, 
        "visualDepthScore": 8,
        "phenotypicDescription": { 
          "en": "Brief scientific description of the exocarp surface traits.", 
          "zh": "关于外果皮表面特征的简要科学描述。" 
        }
      }
      
      IMPORTANT: Return ONLY the raw JSON string. Do not use Markdown code blocks.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response from AI");

    // Clean up potential markdown formatting
    text = text.replace(/```json\n?|\n?```/g, "").trim();

    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};