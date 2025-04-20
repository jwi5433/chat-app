import { fal } from "@fal-ai/client";
import 'dotenv/config' // Ensure environment variables are loaded

// Define the specific model we want this helper to use
const FLUX_PRO_MODEL_ID = "fal-ai/flux-pro/v1.1-ultra";

/**
 * Generates an image using the Fal.ai FLUX Pro model.
 * @param prompt The text prompt for the image.
 * @param aspectRatio The desired aspect ratio (e.g., "1:1", "16:9"). Defaults to "1:1".
 * @returns A Promise resolving to the image URL string, or null if generation fails.
 */
export async function generateImage(
    prompt: string,
    aspectRatio: string = "1:1"
): Promise<string | null> {

    if (!process.env.FAL_KEY) {
        console.error("🔴 [generateImage] FAL_KEY environment variable is not set!");
        // Avoid throwing an error that might crash the server, return null instead.
        return null;
    }

    console.log(`⏳ [generateImage] Calling Fal.ai model: ${FLUX_PRO_MODEL_ID} for prompt: "${prompt.substring(0, 50)}..."`);

    try {
        const result = await fal.subscribe(FLUX_PRO_MODEL_ID, {
            input: {
                prompt,
                aspect_ratio: aspectRatio,
                // Add any other default parameters for FLUX Pro if needed
            },
            logs: process.env.NODE_ENV === 'development', // Enable logs only in development
        }) as any; // Using 'any' for simplicity; define an interface for stricter typing

        // Check if the result contains the expected 'images' array with a URL
        if (result?.data?.images?.[0]?.url) {
            const imageUrl = result.data.images[0].url;
            console.log(`✅ [generateImage] Success, Fal.ai returned image URL: ${imageUrl}`);
            return imageUrl;
        } else {
            console.error(
                "🔴 [generateImage] Failed to generate image or invalid response structure from Fal.ai:",
                JSON.stringify(result, null, 2)
            );
            return null;
        }
    } catch (error) {
        console.error("🔴 [generateImage] Error calling Fal.ai subscribe:", error);
        return null;
    }
} 