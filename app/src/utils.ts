import { DOMAIN } from '../constants'
import EventSource from 'react-native-sse'
import { Model } from '../types'

export function getEventSource({
  headers,
  body,
  type
} : {
  headers?: any,
  body: any,
  type: string
}) {
  const es = new EventSource(`${DOMAIN}/chat/${type}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    method: 'POST',
    body: JSON.stringify(body),
  })

  return es;
}

export function getFirstNCharsOrLess(text:string, numChars:number = 1000) {
  if (text.length <= numChars) {
    return text;
  }
  return text.substring(0, numChars);
}

export function getFirstN({ messages, size = 10 } : { size?: number, messages: any[] }) {
  if (messages.length > size) {
    const firstN = new Array()
    for(let i = 0; i < size; i++) {
      firstN.push(messages[i])
    }
    return firstN
  } else {
    return messages
  }
}

export function getChatType(type: Model) {
  if (type.label.includes('gpt')) {
    return 'gpt'
  }
  if (type.label.includes('cohere')) {
    return 'cohere'
  }
  if (type.label.includes('mistral')) {
    return 'mistral'
  }
  if (type.label.includes('gemini')) {
    return 'gemini'
  }
  else return 'claude'
}
/**
 * Calls the backend image endpoint for text-based or config-based generation.
 * @param payload - Object containing model, prompt, and potentially other JSON data like baseImage.
 * @returns Promise resolving to an object like { image: "url" }
 */
export const callImageGenerationEndpoint = async (
    payload: {
        model: string; // e.g., 'flux-pro', 'stableDiffusionXL'
        prompt: string;
        baseImage?: string; // Optional: For models like illusion diffusion
        aspect_ratio?: string; // Optional: For models like flux-pro
        // Add any other parameters your server might expect in the JSON body
    }
): Promise<{ image: string }> => {
  try {
    console.log(`[callImageGenerationEndpoint] Calling backend for model: ${payload.model}`);

    const endpointPath = '/images/fal'; // Matches the path used in images.tsx
    const fullUrl = `${DOMAIN}${endpointPath}`;
    console.log(`[callImageGenerationEndpoint] Fetching: ${fullUrl}`);
    console.log(`[callImageGenerationEndpoint] Payload:`, payload); // Log the data being sent

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json' // Sending JSON data
      },
      body: JSON.stringify(payload) // Send the whole payload object
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorData = { error: `HTTP error! status: ${response.status}` };
      try {
        const parsedError = JSON.parse(responseText);
        errorData.error = parsedError.error || `Server Error: ${responseText}`;
      } catch (e) {
         errorData.error += `, Response: ${responseText}`;
      }
      console.error("[callImageGenerationEndpoint] Error response from server:", errorData);
      throw new Error(errorData.error);
    }

    const data = JSON.parse(responseText);

    if (!data || typeof data.image !== 'string' || !data.image.startsWith('http')) {
        console.error("[callImageGenerationEndpoint] Invalid response structure:", data);
        throw new Error("API returned an invalid image URL format.");
    }

    console.log(`[callImageGenerationEndpoint] Success, received image URL: ${data.image}`);
    return data; // Return { image: "url" }

  } catch (error) {
    console.error('[callImageGenerationEndpoint] Error during image generation call:', error);
    throw error; // Re-throw
  }
};
// --- END ADD FUNCTION ---

