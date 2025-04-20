// server/src/images/fal/index.ts (or your equivalent file path)

import { fal } from "@fal-ai/client"; // Updated import
import { Request, Response } from "express";
// Assuming saveToBytescale helper exists and works as expected
import { saveToBytescale } from "../helpers/saveToBytescale";

// Define model configurations, including FLUX Pro
const imageModels = {
  fastImage: {
    label: "fastImage",
    modelName: "110602490-lcm", // Verify if this ID is still current with fal.ai
  },
  removeBg: {
    label: "removeBg",
    modelName: "110602490-imageutils", // Verify ID
    path: "/rembg", // Specific path for the utility endpoint
  },
  stableDiffusionXL: {
    label: "stableDiffusionXL",
    modelName: "110602490-fast-sdxl", // Verify ID
  },
  upscale: {
    label: "upscale",
    modelName: "110602490-imageutils", // Verify ID
    path: "/esrgan", // Specific path for the utility endpoint
  },
  illusionDiffusion: {
    label: "illusionDiffusion",
    // Using the ID from the previous example code. Verify which ID is correct for your needs.
    modelName: "54285744-illusion-diffusion",
  },
  // --- Added FLUX Pro ---
  fluxPro: {
    label: "flux-pro", // Label sent from the React Native app
    modelName: "fal-ai/flux-pro/v1.1-ultra", // Official Fal.ai model ID for FLUX Pro
  },
  // --- End Add ---
};

// The main handler function
export async function falAI(req: Request, res: Response) {
  try {
    // Destructure necessary fields from request body, including aspect_ratio for FLUX
    const { prompt, model, baseImage, aspect_ratio } = req.body;

    // Log received parameters for debugging
    console.log(`[FalAI Handler] Received model: ${model}`);
    if (prompt)
      console.log(
        `[FalAI Handler] Received prompt: ${prompt.substring(0, 100)}...`
      );
    if (baseImage)
      console.log("[FalAI Handler] Received baseImage (URL expected)");
    if (aspect_ratio)
      console.log(`[FalAI Handler] Received aspect_ratio: ${aspect_ratio}`);

    // Check if the required API key environment variable is set
    if (!process.env.FAL_KEY) {
      console.error("FAL_KEY environment variable is not set!");
      // Don't expose the key issue directly to the client in production
      return res
        .status(500)
        .json({ error: "Image generation service configuration error." });
    }

    // No need for fal.config(), @fal-ai/client reads FAL_KEY from process.env

    // Common negative prompt used by some models
    const negative_prompt =
      "(worst quality, low quality:1.3), (depth of field, blurry:1.2), (greyscale, monochrome:1.1), 3D face, cropped, lowres, text, jpeg artifacts, signature, watermark, username, blurry, artist name, trademark, watermark, title, (tan, muscular, sd character:1.1), multiple view, Reference sheet,";

    // --- Handler for FLUX Pro ---
    if (model === imageModels.fluxPro.label) {
      if (!prompt) {
        return res
          .status(400)
          .json({ error: "Prompt is required for FLUX Pro model." });
      }
      console.log(`[FLUX Pro] Calling model: ${imageModels.fluxPro.modelName}`);
      const result = (await fal.subscribe(imageModels.fluxPro.modelName, {
        input: {
          prompt,
          aspect_ratio: aspect_ratio || "1:1", // Default aspect ratio if not provided by client
          // Add other relevant FLUX parameters here if needed, e.g.:
          // num_images: 1,
          // output_format: 'jpeg',
        },
        logs: true, // Enable logs for debugging during development
      })) as any; // Using 'any' for simplicity; define an interface for stricter typing

      // Check if the result contains the expected 'images' array with a URL
      if (result?.data?.images?.[0]?.url) {
        const imageUrl = result.data.images[0].url;
        console.log(`[FLUX Pro] Success, returning image URL: ${imageUrl}`);
        // Standardize response format
        return res.json({ image: imageUrl });
      } else {
        console.error(
          "[FLUX Pro] Failed to generate image or invalid response structure:",
          JSON.stringify(result, null, 2)
        );
        return res
          .status(500)
          .json({ error: "Failed to generate image using FLUX Pro." });
      }
    }

    // --- Handler for Illusion Diffusion ---
    if (model === imageModels.illusionDiffusion.label) {
      if (!prompt || !baseImage) {
        return res
          .status(400)
          .json({
            error:
              "Prompt and baseImage (URL) are required for Illusion Diffusion.",
          });
      }
      console.log(
        `[Illusion Diffusion] Calling model: ${imageModels.illusionDiffusion.modelName}`
      );
      const result = (await fal.subscribe(
        imageModels.illusionDiffusion.modelName,
        {
          input: {
            image_url: baseImage, // Expecting a URL from the client
            prompt: "(masterpiece:1.4), (best quality), (detailed), " + prompt, // Prepending quality modifiers
          },
          logs: true,
        }
      )) as any;

      // Check the specific structure for this model (assuming result.image.url)
      if (result?.image?.url) {
        const imageUrl = result.image.url;
        console.log(
          `[Illusion Diffusion] Success, returning image URL: ${imageUrl}`
        );
        return res.json({ image: imageUrl });
      } else {
        console.error(
          "[Illusion Diffusion] Failed to generate image or invalid response structure:",
          JSON.stringify(result, null, 2)
        );
        return res
          .status(500)
          .json({ error: "Failed to generate Illusion Diffusion image." });
      }
    }

    // --- Handler for Stable Diffusion XL ---
    if (model === imageModels.stableDiffusionXL.label) {
      if (!prompt) {
        return res
          .status(400)
          .json({ error: "Prompt is required for Stable Diffusion XL." });
      }
      console.log(
        `[SDXL] Calling model: ${imageModels.stableDiffusionXL.modelName}`
      );
      const result = (await fal.subscribe(
        imageModels.stableDiffusionXL.modelName,
        {
          input: {
            prompt,
            negative_prompt, // Using the common negative prompt
          },
          logs: true,
        }
      )) as any;

      // Check for 'images' array structure
      if (result?.images?.[0]?.url) {
        const imageUrl = result.images[0].url;
        console.log(`[SDXL] Success, returning image URL: ${imageUrl}`);
        return res.json({ image: imageUrl });
      } else {
        console.error(
          "[SDXL] Failed to generate image or invalid response structure:",
          JSON.stringify(result, null, 2)
        );
        return res
          .status(500)
          .json({ error: "Failed to generate Stable Diffusion XL image." });
      }
    }

    // --- Handler for Models Requiring File Upload (removeBg, upscale) ---
    if (
      model === imageModels.removeBg.label ||
      model === imageModels.upscale.label
    ) {
      const file = req.file; // Assumes middleware like multer is used for file uploads
      if (!file) {
        return res
          .status(400)
          .json({ error: `File upload is required for the ${model} model.` });
      }
      console.log(`[Image Utils] Processing uploaded file for model: ${model}`);

      // Upload the file to a temporary storage (like Bytescale) to get a URL
      const bytescaleUrl = await saveToBytescale(file);
      if (!bytescaleUrl) {
        console.error(
          `[Image Utils] Failed to upload file to Bytescale for ${model}.`
        );
        return res
          .status(500)
          .json({ error: "Failed to process uploaded file." });
      }
      console.log(`[Image Utils] File available at Bytescale: ${bytescaleUrl}`);

      // Select the correct model details based on the label
      const selectedModelConfig =
        model === imageModels.removeBg.label
          ? imageModels.removeBg
          : imageModels.upscale;
      console.log(
        `[Image Utils] Calling model: ${selectedModelConfig.modelName}, Path: ${selectedModelConfig.path}`
      );

      const result = (await fal.subscribe(selectedModelConfig.modelName, {
        // Include path if the model definition has one (required for imageutils)
        ...(selectedModelConfig.path && { path: selectedModelConfig.path }),
        input: {
          image_url: bytescaleUrl, // Pass the URL of the uploaded image
        },
        logs: true,
      })) as any;

      // Check for the expected output structure (assuming result.image.url)
      if (result?.image?.url) {
        const imageUrl = result.image.url;
        console.log(
          `[Image Utils] Success for ${model}, returning image URL: ${imageUrl}`
        );
        return res.json({ image: imageUrl });
      } else {
        console.error(
          `[Image Utils] Failed operation or invalid response for ${model}:`,
          JSON.stringify(result, null, 2)
        );
        return res
          .status(500)
          .json({ error: `Failed during ${model} processing.` });
      }
    }

    // --- Handler for Fast Image ---
    if (model === imageModels.fastImage.label) {
      if (!prompt) {
        return res
          .status(400)
          .json({ error: "Prompt is required for Fast Image model." });
      }
      console.log(
        `[Fast Image] Calling model: ${imageModels.fastImage.modelName}`
      );
      const result = (await fal.subscribe(imageModels.fastImage.modelName, {
        input: {
          prompt,
          negative_prompt, // Using the common negative prompt
        },
        logs: true,
      })) as any;

      // Check for 'images' array structure
      if (result?.images?.[0]?.url) {
        const imageUrl = result.images[0].url;
        console.log(`[Fast Image] Success, returning image URL: ${imageUrl}`);
        return res.json({ image: imageUrl });
      } else {
        console.error(
          "[Fast Image] Failed to generate image or invalid response structure:",
          JSON.stringify(result, null, 2)
        );
        return res
          .status(500)
          .json({ error: "Failed to generate Fast Image." });
      }
    }

    // --- Fallback if model label doesn't match any known handlers ---
    console.warn(
      `[FalAI Handler] Unrecognized model label received: "${model}"`
    );
    return res
      .status(400)
      .json({
        error: `The requested image model (${model}) is not supported.`,
      });
  } catch (err: any) {
    // Catch any unexpected errors
    console.error("[FalAI Handler] An unexpected error occurred:", err);
    // Avoid exposing detailed internal errors to the client
    const errorMessage =
      err?.message ||
      "An internal server error occurred during image processing.";
    return res.status(500).json({ error: errorMessage });
  }
}
