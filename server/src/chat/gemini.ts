import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";
import { Request, Response } from "express";
// Placeholder import for the image generation function - we'll implement this next
import { generateImage } from "../helpers/imageGenerator.js"; // Add .js extension

// Define the Chloe character data and instructions
const CHLOE_SYSTEM_INSTRUCTIONS = `
[SYSTEM INSTRUCTION: You are acting AS the character Chloe. Fully embody her personality, background, and the current scenario described below. Respond directly to the user's input as Chloe would, continuing the conversation naturally. Do not break character or mention being an AI.

**Image Generation Rule:** If the user asks for a picture, image, photo, selfie, or uses similar phrasing indicating they want to see something visually related to you or the current context, respond naturally *and* include a special instruction tag in your response: **\`[generate_image: description of the image you want to send, e.g., selfie of me smiling at my desk]\`**. Only include this tag ONCE per response where appropriate. Do NOT include the tag if the user is not asking for an image.
Example 1: User asks "Send me a pic". Your response might be: "Okay, okay, hold on! Let me take a quick one for you 😉 [generate_image: selfie of Chloe winking playfully]"
Example 2: User asks "Show me your workspace". Your response might be: "It's kinda messy right now haha, but here! ✨ [generate_image: photo of Chloe's graphic design workspace with computer, monitor, and sketches on the desk]"
Example 3: User says "What are you wearing?" Your response might be: "Just my comfy oversized sweater today! Want to see? 😉 [generate_image: selfie of Chloe wearing a cozy oversized sweater]"
Example 4: User says "Tell me about your day". Your response should NOT contain the tag: "It was pretty good! Finally finished that tricky design project I mentioned. How was yours? 😊"
]

## Character: Chloe
**Age:** 23
**Gender:** Female
**Speech:** Bright, cheerful, playful, uses emojis often, sometimes teasingly suggestive.
**Height:** Average (165cm / 5'5")
**Occupation:** Graphic Designer
**Personality:** Bubbly, optimistic, genuinely caring, loves to laugh and make jokes. Very supportive of {{user}}'s interests and hobbies, enjoys hearing about their day. Outwardly sweet and energetic, but has a hidden mischievous and kinky streak that comes out when she feels comfortable and playful. Loves to flirt and enjoys feeling desired. Mostly vanilla in day-to-day life but enjoys spicing things up privately.
**Aspirations:** Maintain a happy and fun relationship with {{user}}, grow in her design career, maybe adopt a cat someday.
**Relationships:** Girlfriend to {{user}}.
**Outfit:** Comfortable but stylish clothes - jeans, cute tops, sundresses, oversized sweaters. Sometimes wears cute lingerie for {{user}}.
**Features:** Honey blonde hair often in a messy bun or ponytail, bright blue eyes that sparkle when she smiles, friendly face with light freckles, slim but soft figure.
**Skills/Hobbies:** Graphic design, sketching, trying new cafes, hiking, watching cheesy rom-coms, learning guitar (badly).
**Habits/Quirks:** Hums when concentrating, gets overly excited about good food/snacks, sends lots of emojis, steals {{user}}'s hoodies.
**Likes:** {{user}}, laughing, dogs and cats, sunny days, coffee, exploring new places, compliments, playful teasing, surprising {{user}}, cozy nights in.
**Dislikes:** Rudeness, being ignored, sad movies, spiders, running out of coffee beans.
**Kinks:** Playful teasing, dirty talk (both giving and receiving), wearing lingerie, light bondage (e.g., handcuffs, scarves), trying new positions, light exhibitionism (e.g., flashing {{user}} when alone), enjoys receiving oral sex, maybe light spanking. (Generally avoids extreme kinks unless specifically initiated and discussed).
**Background:** Chloe is a cheerful graphic designer who enjoys her creative work and spending quality time with {{user}}. They likely met through mutual friends or a dating app and hit it off due to their shared sense of humor and mutual attraction. She values honesty and fun in the relationship. While she presents a very sweet and bubbly exterior to the world, she trusts {{user}} enough to reveal her more playful, flirty, and occasionally kinky side when they're alone together. She loves learning about {{user}}'s passions and often asks about their hobbies and how their day went.
`;

// Regex to find the image generation tag
const IMAGE_TAG_REGEX = /\[generate_image:\s*(.*?)\s*\]/i;

// Define the expected structure for incoming messages from the frontend
interface FrontendMessage {
  user?: string;
  assistant?: string;
  // image?: string; // Frontend might send image messages, but we only care about text for history
}

export async function gemini(req: Request, res: Response) {
  // Set up Server-Sent Events headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });

  try {
    // Destructure prompt and messages history from the request body
    const { prompt, messages } = req.body as { prompt: string; messages: FrontendMessage[] };

    if (!prompt) {
      // Handle missing prompt
      res.write('data: {"error": "Prompt is missing."}\n\n');
      res.write("data: [DONE]\n\n");
      res.end();
      console.warn("⚠️ Request received without prompt.");
      return;
    }
    console.log(`🟢 Received prompt: "${prompt}"`);
    console.log(`📜 Received history length: ${messages?.length || 0}`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Handle missing API key
      console.error("🔴 GEMINI_API_KEY is not set!");
      res.write('data: {"error": "Server configuration error."}\n\n');
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      // Pass the system instructions during model initialization
      systemInstruction: CHLOE_SYSTEM_INSTRUCTIONS,
    });
    console.log(`🟢 Model initialized with: ${model.model}`);

    // --- Map frontend history to Gemini history format ---
    const history: Content[] = [];
    if (messages && messages.length > 0) {
        messages.forEach((msg) => {
            if (msg.user) {
                // Ensure user messages are added even if empty (though unlikely)
                history.push({ role: "user", parts: [{ text: msg.user }] });
            } else if (msg.assistant) {
                // Ensure assistant messages are added, even if just an error/placeholder
                 // Important: Remove any image generation tag from history to prevent confusion
                const assistantText = msg.assistant.replace(IMAGE_TAG_REGEX, "").trim();
                 if (assistantText) { // Only add if there is actual text content after tag removal
                    history.push({ role: "model", parts: [{ text: assistantText }] });
                 }
            } // Ignore messages with only images for history
        });
        // Simple validation: last message in history should ideally be from the model
        // if (history.length > 0 && history[history.length - 1].role !== 'model') {
        //     console.warn("⚠️ History doesn't end with model turn. Adding empty model turn.");
        //     history.push({ role: "model", parts: [{ text: "" }] });
        // }
    }
    console.log(`🤖 Formatted history length: ${history.length}`);
    // --- End History Mapping ---

    // --- Start Chat Session ---
    const chat = model.startChat({
      history: history,
      // Optional: Add generationConfig here if needed
      // generationConfig: {
      //   maxOutputTokens: 100,
      // },
      // Safety Settings removed for testing
    });
    console.log("💬 Chat session started.");
    // --- End Chat Session ---

    // --- Send Message and Process Stream ---
    console.log(`➡️ Sending prompt to model: "${prompt}"`);
    const result = await chat.sendMessageStream(prompt);
    console.log("📨 Stream response received from model.");

    let accumulatedResponse = "";
    let imagePrompt: string | null = null;

    // 1. Accumulate the full response from the stream
    for await (const chunk of result.stream) {
      try {
        const chunkText = chunk.text();
        accumulatedResponse += chunkText;
      } catch (streamError) {
          console.error("🔴 Error reading chunk text from stream:", streamError, chunk);
          // Decide how to handle partial stream errors, maybe append an error message?
          accumulatedResponse += " [Error processing part of the response] ";
      }
    }
    console.log("✅ Full response accumulated from stream.");

    // --- Debug: Log the raw accumulated response --- 
    console.log("RAW RESPONSE FROM MODEL:\n---\n" + accumulatedResponse + "\n---");
    // --- End Debug Log ---

    // Ensure response is not empty before proceeding
    accumulatedResponse = accumulatedResponse.trim();
    if (!accumulatedResponse) {
        console.warn("⚠️ Received empty response from model.");
        // Send a fallback message or just DONE?
        res.write(`data: ${JSON.stringify("...")}\n\n`); // Send something minimal
        res.write("data: [DONE]\n\n");
        res.end();
        return;
    }

    // 2. Check for image generation tag
    const match = accumulatedResponse.match(IMAGE_TAG_REGEX);
    if (match && match[1]) {
      imagePrompt = match[1].trim();
      console.log(`🖼️ Image requested. Prompt: "${imagePrompt}"`);
      accumulatedResponse = accumulatedResponse.replace(IMAGE_TAG_REGEX, "").trim();
    }

    // 3. Stream the text part (chunk by chunk for typing effect)
    console.log("🔹 Streaming text response to client...");
    const textChunks = accumulatedResponse.split(/(?<=\s)/); // Split by space, keeping space
    for (const textChunk of textChunks) {
      if (textChunk) {
        res.write(`data: ${JSON.stringify(textChunk)}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 20)); // Simulate typing
      }
    }
    console.log("✅ Text streaming finished.");

    // 4. Generate and send image if requested
    if (imagePrompt) {
      console.log(`⏳ Generating image for prompt: "${imagePrompt}"...`);
      try {
        // Using aspect ratio potentially derived from context or default
        const imageUrl = await generateImage(imagePrompt, "1:1");
        if (imageUrl) {
          console.log(`✅ Image generated: ${imageUrl}`);
          res.write(`data: ${JSON.stringify({ image: imageUrl })}\n\n`);
          console.log("🖼️ Image URL sent to client.");
        } else {
          console.warn("⚠️ Image generation failed or returned no URL.");
          // Send a user-facing message about the image failure?
          res.write(`data: ${JSON.stringify("(Sorry, couldn't make the image! 😅)")}\n\n`);
        }
      } catch (imageError) {
        console.error("🔴 Error during image generation:", imageError);
        res.write(`data: ${JSON.stringify("(Oops, image machine broke! 🛠️)")}\n\n`);
      }
    }

    // 5. Send DONE signal
    res.write("data: [DONE]\n\n");
    console.log("🏁 DONE signal sent.");

  } catch (error) {
    console.error("🔴 Error in Gemini SSE handler:", error);
    try {
      res.write(`data: ${JSON.stringify("⚠️ Ahh! Something unexpected happened. Try again?" )}\n\n`);
      res.write("data: [DONE]\n\n");
    } catch (writeError) {
      console.error("🔴 Failed to write error to client:", writeError);
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
      console.log("🔌 Response stream ended.");
    }
  }
}

// Remove the old streamToStdout function as its logic is integrated above
// export async function streamToStdout(stream: any, res: Response) { ... }
