import { DOMAIN } from "../constants";
import EventSource from "react-native-sse";

export async function getEventSource({
  headers = {},
  body,
  type,
  token,
}: {
  headers?: any;
  body: any;
  type: string;
  token: string;
}) {
  const es = new EventSource(`${DOMAIN}/chat/${type}`, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...headers,
    },
    method: "POST",
    body: JSON.stringify(body),
  });

  return es;
}

/**
 * Ensures an image URL is complete with domain if needed
 * @param imageUrl The image URL to process
 * @returns A complete URL with domain if needed
 */
export const ensureCompleteImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return imageUrl;
  
  // If it's already a complete URL, return it as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a relative path (starts with /images/), prepend the domain
  if (imageUrl.startsWith('/images/')) {
    const fullUrl = `${DOMAIN}${imageUrl}`;
    console.log(`Converted relative image path to full URL: ${fullUrl}`);
    return fullUrl;
  }
  
  // Any other format - assume it needs the domain
  console.log(`Image URL format unclear, adding domain as precaution: ${DOMAIN}${imageUrl}`);
  return `${DOMAIN}${imageUrl}`;
};

export const callImageGenerationEndpoint = async (
  prompt: string,
  file: { uri: string; name: string; type: string } | undefined,
  token: string
): Promise<string> => {
  const endpointPath = "/images/fal";
  const fullUrl = `${DOMAIN}${endpointPath}`;

  const headers: HeadersInit = {
    "Authorization": `Bearer ${token}`
  };
  let requestBody: BodyInit | null = null;

  try {
    if (file) {
      const formData = new FormData();

      formData.append("prompt", prompt);

      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

      formData.append("aspect_ratio", "1:1");

      requestBody = formData as any;
    } else {
      headers["Content-Type"] = "application/json";

      const jsonBody = {
        prompt: prompt,
        style_selections: ["Fooocus V2", "Fooocus Enhance", "Fooocus Sharp"],
        performance_selection: "Speed",
        image_number: 1,
        image_seed: -1,
        aspect_ratios_selection: mapFrontendAspectRatioToFooocus("1:1"),
      };
      requestBody = JSON.stringify(jsonBody);
    }

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: headers,
      body: requestBody,
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage =
          errorData.error ||
          errorData.detail?.[0]?.msg ||
          `Server Error: ${responseText}`;
      } catch (e) {
        errorMessage = `HTTP error! status: ${response.status} - ${response.statusText}, Response: ${responseText}`;
      }
      throw new Error(`Image generation failed: ${errorMessage}`);
    }

    const responseData = JSON.parse(responseText);

    if (!responseData || typeof responseData.image !== "string") {
      throw new Error("Backend returned an invalid image URL format.");
    }

    // Process the image URL to ensure it's a complete URL
    const completeImageUrl = ensureCompleteImageUrl(responseData.image);
    console.log(`Final image URL to be used: ${completeImageUrl}`);
    
    return completeImageUrl;
  } catch (error: any) {
    console.error("Error during image generation call:", error);
    throw new Error(
      `Image generation request failed: ${error.message || error}`
    );
  }
};

function mapFrontendAspectRatioToFooocus(
  frontendAspectRatio: string | undefined
): string | undefined {
  if (!frontendAspectRatio) return undefined;
  switch (frontendAspectRatio) {
    case "1:1":
      return "1024*1024";
    case "4:3":
      return "1152*896";
    case "3:4":
      return "896*1152";
    case "16:9":
      return "1344*768";
    case "9:16":
      return "768*1344";
    default:
      console.warn(
        `Unknown aspect ratio: ${frontendAspectRatio}. Using default.`
      );
      return "1024*1024";
  }
}
