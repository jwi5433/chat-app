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
        console.error("FAL_KEY environment variable is not set!");
        return null;
    }

    try {
        const result = await fal.subscribe(FLUX_PRO_MODEL_ID, {
            input: {
                prompt,
                aspect_ratio: aspectRatio,
            },
            logs: process.env.NODE_ENV === 'development',
        }) as any;

        if (result?.data?.images?.[0]?.url) {
            return result.data.images[0].url;
        } else {
            console.error("Invalid response structure from Fal.ai");
            return null;
        }
    } catch (error) {
        console.error("Error during Fal.ai API call:", error);
        return null;
    }
} 