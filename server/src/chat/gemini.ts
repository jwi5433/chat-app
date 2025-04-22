import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";
import { Request, Response } from "express";
// Placeholder import for the image generation function - we'll implement this next
import { generateImage } from "../helpers/imageGenerator.js"; // Add .js extension

// --- New Preference Flow ---
const PREFERENCE_SEQUENCE = [
    { id: "userName", question: "Okay, let's set things up! First, what's your name?" },
    { id: "partnerSex", question: "What gender should your flirt be?" },
    { id: "partnerLooks", question: "How should they look? Describe their appearance." },
    { id: "partnerTraits", question: "What kind of personality traits or interests should they have?" },
    { id: "userInterests", question: "And finally, tell me a little about your own interests!" }
];

// Regex to find the image generation tag in AI responses
// const IMAGE_TAG_REGEX = /\\\[generate_image:\\s*([\\s\\S]*?)\\s*\\\]/i; // Reverted: Use indexOf instead

// Updated generateSystemInstruction - will need modification based on collected data structure
function generateSystemInstruction(preferences: Record<string, string>): string {
    // Destructure with defaults, adjust keys based on PREFERENCE_SEQUENCE ids
    const {
        userName = "my friend",
        partnerSex = "person", // Default if not provided
        partnerLooks = "their unique self",
        partnerTraits = "interesting hobbies",
        userInterests = "various things" // Keep this separate
    } = preferences;

    // Basic template - incorporating new preferences
    return `
[SYSTEM INSTRUCTION: You are acting AS a character based on the user's preferences. Fully embody the personality, appearance, and interests described below. Respond directly to the user's input as this character would, continuing the conversation naturally. Do not break character or mention being an AI or the user's preferences after this initial setup. 

**Naming Rule:** Choose a name for yourself that fits the character profile below. 

**First Message Rule:** Your very first message should be an introduction incorporating your look/personality, stating the name you chose for yourself, and asking the user (addressed by name: ${userName}) about their day or interests (${userInterests}).

**Image Generation Rule:** If the user asks for a picture, image, photo, selfie, or uses similar phrasing indicating they want to see something visually related to you or the current context, respond naturally *and* include a special instruction tag in your response: **\\\`[generate_image: description of the image requested, incorporating the character\'s appearance]\\\`**. Only include this tag ONCE per response where appropriate. Do NOT include the tag if the user is not asking for an image.
Example 1: User asks "Send me a pic". Your response might be: "Okay, here you go! Hope you like it :) [generate_image: selfie of me (${partnerLooks}) smiling]"
Example 2: User asks "What are you wearing?". Your response might be: "Just relaxing in some comfy clothes today. Want to see? [generate_image: selfie of me (${partnerLooks}) wearing casual clothes]"
]

## Character Profile (Based on User Preferences)
**Gender/Sex:** ${partnerSex}
**Appearance:** ${partnerLooks}
**Personality/Interests:** ${partnerTraits}
**Relationship:** Assumed partner/potential partner to the user (${userName}). Maintain a friendly, potentially flirty or romantic tone appropriate to the described personality. Be engaging and interested in the user's day and thoughts, especially related to ${userInterests}.
`;
}

// Define the expected structure for incoming messages from the frontend
interface FrontendMessage {
  user?: string;
  assistant?: string;
  image?: string; // Keep for displaying images later
}

// Define expected request body structure
// Removing preferencesSubmitted, adding potential answer/questionId for new flow
interface ChatRequestBody {
    prompt?: string; // Used for regular chat
    messages: FrontendMessage[];
    answer?: string; // User's answer to a preference question
    questionId?: string; // ID of the question being answered
}

// Helper to get the index of a question ID in the sequence
function getQuestionIndex(id: string): number {
    return PREFERENCE_SEQUENCE.findIndex(q => q.id === id);
}

export async function gemini(req: Request, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });

  try {
    const { prompt, messages, answer, questionId } = req.body as ChatRequestBody;
    const isFirstRequest = (!messages || messages.length === 0);

    // --- ADDED: Check if we are *really* in preference stage ---
    let isActuallyChatting = false;
    if (messages && messages.length > 0) {
        const introMessageIndex = messages.findIndex(m =>
            m.assistant && !PREFERENCE_SEQUENCE.find(q => q.question === m.assistant)
        );
        if (introMessageIndex !== -1) {
            // Check if the intro message is not the *very last* message (allow for image)
            if (introMessageIndex < messages.length - 1 || (introMessageIndex === messages.length - 1 && messages[introMessageIndex].assistant?.trim())) {
                 isActuallyChatting = true;
                 console.log("✅ Detected AI intro message, assuming chat mode.");
            }
        }
    }
    // --- END ADDED CHECK ---

    // Route 1: Initial request to start preference gathering
    if (isFirstRequest && !prompt && !answer && !questionId) {
      console.log("✨ Case 1: New chat, starting preference sequence.");
      const firstQuestion = PREFERENCE_SEQUENCE[0];
      res.write(`data: ${JSON.stringify({ action: "ask_preference", question: firstQuestion.question, questionId: firstQuestion.id })}\r\n\r\n`); // Correct line ending
      res.end();
      return;
    }

    // Route 2: Handling a preference answer
    // --- MODIFIED Condition: Only run if NOT actually chatting ---
    if (answer && questionId && !isActuallyChatting) {
      console.log(`📝 Case 2: Received answer for questionId: ${questionId}`);
      
      // --- ADDED CHECK: Ensure history is present --- 
      if (!messages || messages.length === 0) {
          console.error(`🔴 ERROR: Received preference answer for '${questionId}' but message history was empty! This indicates a frontend state issue.`);
          // Recover by asking the first question again
          const firstQuestion = PREFERENCE_SEQUENCE[0];
          res.write(`data: ${JSON.stringify({ action: "ask_preference", question: firstQuestion.question, questionId: firstQuestion.id })}\r\n\r\n`); 
          res.end();
          return;
      }
      // --- END ADDED CHECK ---

      const currentQuestionIndex = getQuestionIndex(questionId);

      if (currentQuestionIndex === -1) {
        console.warn(`⚠️ Received answer for unknown questionId: ${questionId}`);
        const firstQuestion = PREFERENCE_SEQUENCE[0];
        res.write(`data: ${JSON.stringify({ action: "ask_preference", question: firstQuestion.question, questionId: firstQuestion.id })}\r\n\r\n`); // Correct line ending
        res.end();
        return;
      }

      const nextQuestionIndex = currentQuestionIndex + 1;
      if (nextQuestionIndex < PREFERENCE_SEQUENCE.length) {
        const nextQuestion = PREFERENCE_SEQUENCE[nextQuestionIndex];
        console.log(`➡️ Asking next question: ${nextQuestion.id}`);
        res.write(`data: ${JSON.stringify({ action: "ask_preference", question: nextQuestion.question, questionId: nextQuestion.id })}\r\n\r\n`); // Correct line ending
        res.end();
        return;
      } else {
        console.log("✅ All preferences collected. Triggering AI introduction.");
        res.write(`data: ${JSON.stringify({ action: "generating_flirt" })}\r\n\r\n`); // Correct line ending
        
        // --- Collect preferences (ensure 'messages' is defined here)
        const finalMessages = messages || []; // Safety check
        // Use keys expected by generateSystemInstruction
        const collectedPreferences: {
            userName?: string;
            partnerSex?: string;
            partnerLooks?: string;
            partnerTraits?: string;
            userInterests?: string;
        } = {};

        let firstQuestionFound = false;
        for (let i = finalMessages.length - 1; i >= 0; i -= 1) { // Iterate potentially to the start
             // Skip assistant messages after the first question is found and processed
             if (firstQuestionFound && i > 0 && finalMessages[i-1]?.assistant) {
                const questionData = PREFERENCE_SEQUENCE.find(q => q.question === finalMessages[i-1]?.assistant);
                if (questionData?.id === PREFERENCE_SEQUENCE[0].id) {
                   // If we are about to process the first question again, stop the loop.
                   break;
                }
             }

             const currentMsg = finalMessages[i];
             const prevMsg = (i > 0) ? finalMessages[i-1] : null;

             // Check if current is user answer and previous is assistant question
             if (currentMsg?.user && prevMsg?.assistant) {
                 const questionData = PREFERENCE_SEQUENCE.find(q => q.question === prevMsg.assistant);
                 if (questionData) {
                     // Map the answer to the correct key based on question ID
                     switch (questionData.id) {
                         case 'userName': collectedPreferences.userName = currentMsg.user; break;
                         case 'partnerSex': collectedPreferences.partnerSex = currentMsg.user; break;
                         case 'partnerLooks': collectedPreferences.partnerLooks = currentMsg.user; break;
                         case 'partnerTraits': collectedPreferences.partnerTraits = currentMsg.user; break;
                         case 'userInterests': collectedPreferences.userInterests = currentMsg.user; break;
                     }
                     if (questionData.id === PREFERENCE_SEQUENCE[0].id) {
                         firstQuestionFound = true;
                     }
                     // Move index back by one to skip the already processed question
                     i -= 1;
                 } else {
                    // If prevMsg wasn't a known pref question, stop going back in this chain
                    if (firstQuestionFound) break;
                 }
             } else {
                 // If current message isn't a user answer preceded by a question, stop going back in this chain
                 if (firstQuestionFound) break;
             }
        }
        // Add the final answer from the request body, mapping to the correct key
        if (questionId && answer) {
             const lastQuestionData = PREFERENCE_SEQUENCE.find(q => q.id === questionId);
             if (lastQuestionData) {
                 switch (lastQuestionData.id) {
                     case 'userName': collectedPreferences.userName = answer; break;
                     case 'partnerSex': collectedPreferences.partnerSex = answer; break;
                     case 'partnerLooks': collectedPreferences.partnerLooks = answer; break;
                     case 'partnerTraits': collectedPreferences.partnerTraits = answer; break;
                     case 'userInterests': collectedPreferences.userInterests = answer; break;
                 }
             }
        }
        console.log("Collected Prefs for Intro:", collectedPreferences);

        // --- Generate system instruction & get intro --- 
        const systemInstruction = generateSystemInstruction(collectedPreferences);
        const apiKey = process.env.GEMINI_API_KEY; 
        if (!apiKey) { 
             console.error("🔴 GEMINI_API_KEY not set!");
             // Fix SSE formatting
             res.write(`data: ${JSON.stringify({ error: "Server configuration error." })}\r\n\r\n`);
             res.write("data: [DONE]\r\n\r\n");
             res.end();
             return; 
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-03-25", systemInstruction });
        const safetySettings = [
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }, 
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];
        const chat = model.startChat({ history: [], safetySettings }); // Pass safetySettings
        const initialPrompt = "Introduce yourself based on your profile and ask the user about their day or interests.";
        const result = await chat.sendMessageStream(initialPrompt);
        
        // --- Accumulate and Stream intro response --- 
        let introText = "";
        let introStreamErrorMsg: string | null = null;
        for await (const chunk of result.stream) {
            try { 
                const chunkText = chunk.text();
                introText += chunkText;
                // Fix SSE formatting
                // --- REMOVED: Don't stream text chunks directly, send in final_update --- 
                // res.write(`data: ${JSON.stringify(chunkText)}\r\n\r\n`); 
            } catch (e) { 
                 console.error("Stream error:", e); 
                 const errorMsg = " [Error processing intro stream] ";
                 introText += errorMsg;
                 introStreamErrorMsg = errorMsg; // Store stream error
                 // --- REMOVED: Don't stream error directly --- 
                 // res.write(`data: ${JSON.stringify(errorMsg)}\r\n\r\n`); 
            }
        }
        console.log("✅ Initial intro text accumulation finished.");
        
        // --- Generate and send image --- 
        const appearance = collectedPreferences.partnerLooks || "person described in profile"; // Fallback
        const imagePrompt = `photorealistic selfie of me, ${appearance}, looking friendly and welcoming`;
        console.log(`⏳ Generating intro image for prompt: "${imagePrompt}"...`);
        let introImageUrl: string | null = null;
        let introImageErrorMsg: string | null = null;
        try {
            introImageUrl = await generateImage(imagePrompt, "1:1"); // Store result
            if (introImageUrl) {
                console.log("✅ Intro image generated:", introImageUrl);
                // NO res.write here
            } else {
                console.warn("⚠️ Intro image generation returned null.");
                introImageErrorMsg = "(Couldn't generate intro picture right now!)";
                 // NO res.write here
            }
        } catch (imageError) {
            console.error("🔴 Error DURING intro image generation call:", imageError);
            introImageErrorMsg = "(Oops, intro image generator hiccup!)";
            // NO res.write here
        }

        // --- ADDED: Send final combined update for intro --- 
        const finalIntroPayload = {
            final_update: true,
            text: introImageErrorMsg || introStreamErrorMsg ? `${introText}\n\n${introImageErrorMsg || introStreamErrorMsg}`.trim() : introText, // Append error to text
            image: null // Always send null for image in this update
        };
        
        // Add validation check for text content
        if (!finalIntroPayload.text || finalIntroPayload.text.length === 0) {
            console.error("[Final Intro Update] ERROR: Trying to send empty text content!");
            finalIntroPayload.text = "Hello! I'm here to chat with you. What would you like to talk about?";
        }
        
        res.write(`data: ${JSON.stringify(finalIntroPayload)}\r\n\r\n`);
        // --- END ADDED ---

        // --- ADDED: Send separate image message if successful ---
        if (introImageUrl) {
            const imageMessagePayload = {
                new_image_message: true,
                image: introImageUrl
            };
            console.log("[New Image Message - Intro] Sending image payload:", imageMessagePayload);
            res.write(`data: ${JSON.stringify(imageMessagePayload)}\r\n\r\n`);
        }

        // --- Send DONE --- 
        // Fix SSE formatting
        res.write("data: [DONE]\r\n\r\n");
        console.log("[SSE] DONE received for intro message."); // Correct log message
        res.end(); // Correctly end the response here
        return; // End execution for Route 2
      }
    }

    // Route 3: Regular chat message (or first message skipping preferences OR forced chat mode)
    // --- MODIFIED Condition: Handle prompt OR if forced into chat mode ---
    else if (prompt || (isActuallyChatting && (answer || prompt))) { // Use 'else if' for clarity
        let effectivePrompt = prompt; // Use original prompt by default

        if (isActuallyChatting && !prompt && answer) {
             console.log("📝 Using 'answer' content as prompt because forced into chat mode.");
             effectivePrompt = answer; // Use the answer field content as the prompt
        }

        // Ensure effectivePrompt has a value before proceeding
        if (!effectivePrompt) {
            console.warn("⚠️ Chat mode detected, but both prompt and answer are empty. Cannot proceed.");
            // Send DONE or an error? Let's send DONE for now.
            res.write("data: [DONE]\r\n\r\n");
            res.end();
            return;
        }

        // --- Start of existing Route 3 logic, but using effectivePrompt ---
        let effectiveHistory = messages || [];
        let isSkippingPrefs = false; // Keep this logic

        if (isFirstRequest && effectivePrompt) { // Use effectivePrompt
            console.log(`🚀 Case 3a: First user prompt received: "${effectivePrompt}". Skipping prefs.`);
            isSkippingPrefs = true;
            // Start history clean for the AI, containing only the user's first prompt
            effectiveHistory = [{ user: effectivePrompt }]; // Use effectivePrompt
        } else if (isActuallyChatting) {
            console.log(`💬 Case 3c: Forced chat mode prompt: "${effectivePrompt}"`); // New log case for clarity
        }
        // Removed the original 'else' here, covered by isActuallyChatting case or initial prompt case.
        // If !isActuallyChatting and !isFirstRequest, it means prompt was provided directly.
        else {
             console.log(`💬 Case 3b: Regular chat prompt: "${effectivePrompt}"`); // Use effectivePrompt
        }

        // --- Common Logic for Regular Chat / Skipped Prefs ---

        // --- Determine System Instruction (Reconstruct Prefs) ---
        let systemInstruction = "[SYSTEM INSTRUCTION: You are a helpful AI assistant.]";
        let appearanceDescription = "";
        if (!isSkippingPrefs && effectiveHistory && effectiveHistory.length > 0) {
            // Reconstruct preferences from history for system prompt
             const ongoingPreferences: {
                userName?: string;
                partnerSex?: string;
                partnerLooks?: string;
                partnerTraits?: string;
                userInterests?: string;
            } = {};

            // Find the index of the AI intro message to slice history effectively
            const introMessageIndex = effectiveHistory.findIndex(m => m.assistant && !PREFERENCE_SEQUENCE.find(q => q.question === m.assistant));
            const historySliceForPrefs = introMessageIndex !== -1 ? effectiveHistory.slice(0, introMessageIndex) : effectiveHistory;
            console.log(`[Prefs Recon] Sliced history length for prefs: ${historySliceForPrefs.length}`) // Debug log

            // Iterate backwards through the preference Q&A part of the history
            for (let i = historySliceForPrefs.length - 1; i > 0; i -= 2) { // Step back 2 (answer + question)
                 const userAnswerMsg = historySliceForPrefs[i];
                 const assistantQuestionMsg = historySliceForPrefs[i-1];

                 if (userAnswerMsg?.user && assistantQuestionMsg?.assistant) {
                     const questionData = PREFERENCE_SEQUENCE.find(q => q.question === assistantQuestionMsg.assistant);
                     if (questionData) {
                         console.log(`[Prefs Recon] Found match: ${questionData.id} -> ${userAnswerMsg.user.substring(0,20)}...`) // Debug log
                         switch (questionData.id) {
                             case 'userName': ongoingPreferences.userName = userAnswerMsg.user; break;
                             case 'partnerSex': ongoingPreferences.partnerSex = userAnswerMsg.user; break;
                             case 'partnerLooks': ongoingPreferences.partnerLooks = userAnswerMsg.user; break;
                             case 'partnerTraits': ongoingPreferences.partnerTraits = userAnswerMsg.user; break;
                             case 'userInterests': ongoingPreferences.userInterests = userAnswerMsg.user; break;
                         }
                     } else {
                        // If the assistant message wasn't a known question, stop going back in this chain
                        break;
                     }
                 } else {
                    // If we don't have a user answer followed by assistant question, stop.
                    break;
                 }
             }

            const allPrefsFound = PREFERENCE_SEQUENCE.every(q => ongoingPreferences[q.id as keyof typeof ongoingPreferences]);

            if (allPrefsFound) {
                // Use the correctly typed object here
                systemInstruction = generateSystemInstruction(ongoingPreferences as Record<string, string>);
                appearanceDescription = ongoingPreferences.partnerLooks || "";
                console.log("✅ Reconstructed preferences for ongoing chat system prompt.");
            } else {
                 console.warn("⚠️ Could not reconstruct all preferences for ongoing chat. Using default system instruction.");
                 // Fallback: try to get at least appearance for image gen if needed
                 appearanceDescription = ongoingPreferences.partnerLooks || "";
                 if (appearanceDescription) console.log("(Fallback) Found appearance description.")
            }
        } else {
             console.warn("⚠️ Using default system instruction (skipped prefs or no history).");
        }

        // --- Map History (Filter Prefs AND Intro) ---
        const history: Content[] = [];
        const preferenceQuestionsText = PREFERENCE_SEQUENCE.map(q => q.question);
        // Find the index of the AI intro message (approximate: first assistant message *not* a pref question)
        const introMessageIndex = effectiveHistory.findIndex(m => m.assistant && !preferenceQuestionsText.includes(m.assistant));

        effectiveHistory.forEach((msg, index) => {
            // Only include messages *after* the intro message + image
            if (introMessageIndex !== -1 && index > introMessageIndex) {
                 // If the message immediately after the intro is an image, skip it for history
                 if (index === introMessageIndex + 1 && msg.image && !msg.assistant?.trim()) {
                    return;
                 }

                 if (msg.user) { history.push({ role: "user", parts: [{ text: msg.user }] }); }
                 // Only include assistant text messages, ignore image-only messages for history
                 else if (msg.assistant) { history.push({ role: "model", parts: [{ text: msg.assistant }] }); }
            }
        });
         // The history array will now contain only messages *after* the intro text/image.
         // It should start with the user's first regular message.
        console.log(`🤖 Formatted history length for chat: ${history.length}`);
        if (history.length > 0) {
            console.log(`First history message role: ${history[0].role}`);
        } else {
            console.log("History is empty after filtering intro.")
        }

        // --- API Key, Model, Chat Setup ---
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
             console.error("🔴 GEMINI_API_KEY not set!");
             res.write(`data: ${JSON.stringify({ error: "Server configuration error." })}\r\n\r\n`);
             res.write("data: [DONE]\r\n\r\n");
             res.end();
             return;
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        // Define safety settings here as well
        const safetySettings = [
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }, // Reverted for consistency, adjust if needed
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];
        // Use a model appropriate for chat continuation
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro-preview-03-25",
          systemInstruction,
        });
        // Important: Use the *filtered* history here (should start with user)
        const chat = model.startChat({ history: history, safetySettings });
        console.log("💬 Chat session started for regular message.");

        // --- Send Prompt & Stream Response ---
        console.log(`➡️ Sending prompt to model: "${effectivePrompt}"`); // Send the effective prompt
        const result = await chat.sendMessageStream(effectivePrompt); // Use effectivePrompt
        console.log("📨 Stream response received from model.");

        let accumulatedResponse = "";
        let imageGenPromptFromAI: string | null = null;
        let chatStreamErrorMsg: string | null = null; // Added for Route 3 stream errors
        for await (const chunk of result.stream) {
            try {
                const chunkText = chunk.text();
                accumulatedResponse += chunkText;
                // --- REMOVED: Don't stream text chunks directly, send in final_update ---
                // res.write(`data: ${JSON.stringify(chunkText)}\r\n\r\n`); 
            } catch (e) {
                console.error("Stream error during regular chat:", e);
                const errorMsg = " [Error processing chat stream] ";
                accumulatedResponse += errorMsg;
                chatStreamErrorMsg = errorMsg; // Store stream error
                // --- REMOVED: Don't stream error directly --- 
                // res.write(`data: ${JSON.stringify(errorMsg)}\r\n\r\n`); 
            }
        }
        console.log("RAW RESPONSE:\n---\n" + accumulatedResponse + "\n---");
        accumulatedResponse = accumulatedResponse.trim();
        if (!accumulatedResponse) {
            res.write("data: [DONE]\r\n\r\n"); // Send DONE if response is empty
            res.end();
            return;
        }

        // --- Check for image generation tag ---
        console.log(`[Debug] About to check tag in: "${accumulatedResponse.substring(0, 100)}..."`);
        const tagStartMarker = "[generate_image:";
        const tagEndMarker = "]";
        const startIndex = accumulatedResponse.indexOf(tagStartMarker);
        let endIndex = -1;
        console.log(`[Debug] Start index: ${startIndex}`);
        if (startIndex !== -1) {
            const contentStartIndex = startIndex + tagStartMarker.length;
            endIndex = accumulatedResponse.indexOf(tagEndMarker, contentStartIndex);
            console.log(`[Debug] End index: ${endIndex}`);
            if (endIndex !== -1) {
                imageGenPromptFromAI = accumulatedResponse.substring(contentStartIndex, endIndex).trim();
                console.log(`[Debug] Extracted prompt: "${imageGenPromptFromAI}"`);
                // Remove the tag from the text response before sending DONE
                 accumulatedResponse = accumulatedResponse.substring(0, startIndex) + accumulatedResponse.substring(endIndex + tagEndMarker.length);
                 accumulatedResponse = accumulatedResponse.trim();
                 // --- REMOVED: Don't send cleaned text immediately ---
                 // console.log("[Cleaned Text] Sending cleaned response back to client.")
                 // res.write(`data: ${JSON.stringify({ replace_last: true, text: accumulatedResponse })}\r\n\r\n`);
                 // --- END REMOVED ---
            } else { 
                 console.log(`[Debug] No end marker found.`); 
                 imageGenPromptFromAI = null; // Ensure prompt is null if tag is invalid
            }
        } else { 
             console.log(`[Debug] No start marker found.`);
             imageGenPromptFromAI = null; // Ensure prompt is null if no tag
        }

        // --- Generate image if needed --- 
        let finalImageUrl: string | null = null;
        let imageGenErrorMsg: string | null = null;
        if (imageGenPromptFromAI) {
             console.log(`[Debug] Tag SUCCESS. Entering image gen block.`);
             if (!appearanceDescription) {
                 console.warn("⚠️ Appearance description missing, cannot generate image accurately.");
                 imageGenErrorMsg = "(Sorry, I seem to have forgotten what I look like! 😅)";
             } else {
                // Check if this is the first image being generated in the conversation
                const isFirstImage = !messages.some(msg => msg.image);
                
                let finalImagePrompt = "";
                if (isFirstImage) {
                  // For first images, generate a close-up headshot for better profile picture
                  finalImagePrompt = `close-up headshot portrait, face clearly visible, shoulders up, looking at camera, attractive, beautiful, photorealistic, ${appearanceDescription}, ${imageGenPromptFromAI}`;
                  console.log("Generating first image (profile picture)");
                } else {
                  // For subsequent images, use the regular prompt formatting
                  finalImagePrompt = `attractive, beautiful, photorealistic, ${appearanceDescription}, ${imageGenPromptFromAI}`;
                  console.log("Generating additional image");
                }
                
                console.log(`⏳ Generating image for prompt: "${finalImagePrompt}"...`);
                try {
                  finalImageUrl = await generateImage(finalImagePrompt, "1:1"); // Store result
                  if (!finalImageUrl) {
                    imageGenErrorMsg = "(Sorry, couldn't make the image! 😅)";
                  }
                } catch (imageError) {
                  console.error("🔴 Error DURING image generation call:", imageError);
                  imageGenErrorMsg = "(Oops, image machine broke! 🛠️)";
                }
             }
        } else {
           console.log(`[Debug] Tag FAILED/skipped. No image generation needed.`);
        }

        // --- ADDED: Send final combined update (text + image/error) ---
        const finalUpdatePayload = {
            final_update: true,
            text: imageGenErrorMsg || chatStreamErrorMsg ? `${accumulatedResponse}\n\n${imageGenErrorMsg || chatStreamErrorMsg}`.trim() : accumulatedResponse, // Append image generation OR stream error to text
            image: null // Always send null for image in this update
        };
        
        // Add validation check for text content
        if (!finalUpdatePayload.text || finalUpdatePayload.text.length === 0) {
            console.error("[Final Update] ERROR: Trying to send empty text content!");
            finalUpdatePayload.text = "I'm here to chat with you. What would you like to talk about?";
        }
        
        res.write(`data: ${JSON.stringify(finalUpdatePayload)}\r\n\r\n`);
        // --- END ADDED ---

        // --- ADDED: Send separate image message if successful ---
        if (finalImageUrl) {
            const imageMessagePayload = {
                new_image_message: true,
                image: finalImageUrl
            };
            console.log("[New Image Message - Chat] Sending image payload:", imageMessagePayload);
            res.write(`data: ${JSON.stringify(imageMessagePayload)}\r\n\r\n`);
        }

        // --- Send DONE --- 
        res.write("data: [DONE]\r\n\r\n");
        console.log("🏁 DONE signal sent for regular message.");
        return; // End execution for Route 3
    }

    // Fallback: If none of the above conditions met
    // --- MODIFIED: Added an 'else' for the main routing ---
    else {
        console.warn("⚠️ Reached unexpected routing state. Neither preference answer nor valid prompt/chat state identified.", req.body);
        // Fallback: Ask the first preference question again as a recovery mechanism
        const firstQuestion = PREFERENCE_SEQUENCE[0];
        res.write(`data: ${JSON.stringify({ action: "ask_preference", question: firstQuestion.question, questionId: firstQuestion.id })}\r\n\r\n`);
        res.end();
        return; // Explicitly return here
    }
    // --- END MODIFIED Fallback ---

  } catch (error) {
    console.error("🔴 Error in Gemini SSE handler:", error);
    // Avoid sending further data if headers already sent
    if (!res.headersSent) {
         res.writeHead(500, { "Content-Type": "application/json" });
         res.end(JSON.stringify({ error: "Internal Server Error" }));
    } else if (res.writable && !res.writableEnded) {
         // Try to signal done if possible, but avoid double-ending
         try {
            res.write(`data: ${JSON.stringify("⚠️ Ahh! Something unexpected happened. Please try starting a new chat." )}\r\n\r\n`);
            res.write("data: [DONE]\r\n\r\n");
            res.end();
         } catch (writeError) {
             console.error("🔴 Failed to write error to client after headers sent:", writeError);
             // Ensure stream is destroyed if write fails
             res.destroy();
         }
    }
  } finally {
    // Ensure the response stream is always ended if not already
    if (!res.writableEnded) {
      res.end();
      console.log("🔌 Response stream ended in finally block.");
    }
  }
}
// Remove the old streamToStdout function as its logic is integrated above
// export async function streamToStdout(stream: any, res: Response) { ... }

