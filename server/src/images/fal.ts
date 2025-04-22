// server/src/images/fal/index.ts (or your equivalent file path)

import { fal } from "@fal-ai/client";
import { Request, Response } from "express";
import { saveToBytescale } from "../helpers/saveToBytescale";

const imageModels = {
  fastImage: {
    label: "fastImage",
    modelName: "110602490-lcm",
  },
  removeBg: {
    label: "removeBg",
    modelName: "110602490-imageutils",
    path: "/rembg",
  },
  stableDiffusionXL: {
    label: "stableDiffusionXL",
    modelName: "110602490-fast-sdxl",
  },
  upscale: {
    label: "upscale",
    modelName: "110602490-imageutils",
    path: "/esrgan",
  },
  illusionDiffusion: {
    label: "illusionDiffusion",
    modelName: "54285744-illusion-diffusion",
  },
  fluxPro: {
    label: "flux-pro",
    modelName: "fal-ai/flux-pro/v1.1-ultra",
  },
};

export async function falAI(req: Request, res: Response) {
  try {
    const { prompt, model, baseImage, aspect_ratio } = req.body;

    if (!process.env.FAL_KEY) {
      return res
        .status(500)
        .json({ error: "Image generation service configuration error." });
    }

    const negative_prompt =
      "(worst quality, low quality:1.3), (depth of field, blurry:1.2), (greyscale, monochrome:1.1), 3D face, cropped, lowres, text, jpeg artifacts, signature, watermark, username, blurry, artist name, trademark, watermark, title, (tan, muscular, sd character:1.1), multiple view, Reference sheet,";

    if (model === imageModels.fluxPro.label) {
      if (!prompt) {
        return res
          .status(400)
          .json({ error: "Prompt is required for FLUX Pro model." });
      }
      
      const result = await fal.subscribe(imageModels.fluxPro.modelName, {
        input: {
          prompt,
          aspect_ratio: aspect_ratio || "1:1",
        },
        logs: process.env.NODE_ENV === 'development',
      }) as any;

      if (result?.data?.images?.[0]?.url) {
        return res.json({ image: result.data.images[0].url });
      } else {
        return res
          .status(500)
          .json({ error: "Failed to generate image using FLUX Pro." });
      }
    }

    if (model === imageModels.illusionDiffusion.label) {
      if (!prompt || !baseImage) {
        return res
          .status(400)
          .json({
            error:
              "Prompt and baseImage (URL) are required for Illusion Diffusion.",
          });
      }
      
      const result = await fal.subscribe(
        imageModels.illusionDiffusion.modelName,
        {
          input: {
            image_url: baseImage,
            prompt: "(masterpiece:1.4), (best quality), (detailed), " + prompt,
          },
          logs: process.env.NODE_ENV === 'development',
        }
      ) as any;

      if (result?.image?.url) {
        return res.json({ image: result.image.url });
      } else {
        return res
          .status(500)
          .json({ error: "Failed to generate Illusion Diffusion image." });
      }
    }

    if (model === imageModels.stableDiffusionXL.label) {
      if (!prompt) {
        return res
          .status(400)
          .json({ error: "Prompt is required for Stable Diffusion XL." });
      }
      
      const result = await fal.subscribe(
        imageModels.stableDiffusionXL.modelName,
        {
          input: {
            prompt,
            negative_prompt,
          },
          logs: process.env.NODE_ENV === 'development',
        }
      ) as any;

      if (result?.images?.[0]?.url) {
        return res.json({ image: result.images[0].url });
      } else {
        return res
          .status(500)
          .json({ error: "Failed to generate Stable Diffusion XL image." });
      }
    }

    if (
      model === imageModels.removeBg.label ||
      model === imageModels.upscale.label
    ) {
      const file = req.file;
      if (!file) {
        return res
          .status(400)
          .json({ error: `File upload is required for the ${model} model.` });
      }

      const bytescaleUrl = await saveToBytescale(file);
      if (!bytescaleUrl) {
        return res
          .status(500)
          .json({ error: "Failed to process uploaded file." });
      }

      const selectedModelConfig =
        model === imageModels.removeBg.label
          ? imageModels.removeBg
          : imageModels.upscale;
          
      const result = await fal.subscribe(selectedModelConfig.modelName, {
        ...(selectedModelConfig.path && { path: selectedModelConfig.path }),
        input: {
          image_url: bytescaleUrl,
        },
        logs: process.env.NODE_ENV === 'development',
      }) as any;

      if (result?.image?.url) {
        return res.json({ image: result.image.url });
      } else {
        return res
          .status(500)
          .json({ error: `Failed during ${model} processing.` });
      }
    }

    if (model === imageModels.fastImage.label) {
      if (!prompt) {
        return res
          .status(400)
          .json({ error: "Prompt is required for Fast Image model." });
      }
      
      const result = await fal.subscribe(imageModels.fastImage.modelName, {
        input: {
          prompt,
          negative_prompt,
        },
        logs: process.env.NODE_ENV === 'development',
      }) as any;

      if (result?.images?.[0]?.url) {
        return res.json({ image: result.images[0].url });
      } else {
        return res
          .status(500)
          .json({ error: "Failed to generate Fast Image." });
      }
    }

    return res
      .status(400)
      .json({
        error: `The requested image model (${model}) is not supported.`,
      });
  } catch (err: any) {
    const errorMessage =
      err?.message ||
      "An internal server error occurred during image processing.";
    return res.status(500).json({ error: errorMessage });
  }
}
