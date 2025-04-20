import { DOMAIN } from '../constants'
import EventSource from 'react-native-sse'

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

/**
 * Calls the backend image endpoint for text-based generation.
 * @param payload - Object containing model and prompt.
 * @returns Promise resolving to an object like { image: "url" }
 */
export const callImageGenerationEndpoint = async (
    payload: {
        model: string; 
        prompt: string;
    }
): Promise<{ image: string }> => {
  try {
    console.log(`[callImageGenerationEndpoint] Calling backend for model: ${payload.model}`);

    const endpointPath = '/images/fal'; 
    const fullUrl = `${DOMAIN}${endpointPath}`;
    console.log(`[callImageGenerationEndpoint] Fetching: ${fullUrl}`);
    console.log(`[callImageGenerationEndpoint] Payload:`, payload);

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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
    return data;

  } catch (error) {
    console.error('[callImageGenerationEndpoint] Error during image generation call:', error);
    throw error;
  }
};

