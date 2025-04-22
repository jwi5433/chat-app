import {
  View,
  Text,
  KeyboardAvoidingView,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Image,
  Dimensions,
  Modal,
  Button,
  ViewStyle,
  TextStyle,
  ImageStyle,
  DimensionValue,
  Platform
} from "react-native";
import "react-native-get-random-values";
import { useContext, useState, useRef, useEffect, useMemo } from "react";
import { ThemeContext } from "../context";
import { getEventSource, callImageGenerationEndpoint } from "../utils";
import { v4 as uuid } from "uuid";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useActionSheet } from "@expo/react-native-action-sheet";
import Markdown from "@ronradtke/react-native-markdown-display";
import { ITheme } from '../../types';
import FlirtChat, { MessageType as FlirtMessageType } from '../components/FlirtChat';

type Message = {
  user?: string;
  assistant?: string;
  image?: string;
  _id?: string;
};

const { width } = Dimensions.get("window");

// Define possible stages for the preference/chat flow
type PreferenceStage = 'idle' | 'requesting' | 'userName' | 'partnerSex' | 'partnerLooks' | 'partnerTraits' | 'userInterests' | 'generating' | 'chatting' | 'error';

// Define styles type
interface ChatStyles {
  container: ViewStyle;
  userMessageOuterWrapper: ViewStyle;
  greetingContainer: ViewStyle;
  greeting: TextStyle;
  userMessageContainer: ViewStyle;
  userMessageWrapper: ViewStyle;
  userMessageText: TextStyle;
  responseContainerPressable: ViewStyle;
  responseContainer: ViewStyle;
  imageStyle: ImageStyle;
  scrollContainer: ViewStyle;
  chatInputContainer: ViewStyle;
  input: TextStyle;
  buttonStyle: ViewStyle;
  imageButtonStyle: ViewStyle;
  buttonDisabled: ViewStyle;
  buttonPressed: ViewStyle;
  loadingContainer: ViewStyle;
  generatingContainer: ViewStyle;
  generatingText: TextStyle;
  loading: ViewStyle;
}

// Define return type for getStyles function
interface StylesResult {
  sheet: ChatStyles;
  markdown: any;
}

// --- getStyles defined OUTSIDE the component ---
const getStyles = (theme: ITheme): StylesResult => {
  if (!theme || typeof theme !== 'object' || !theme.backgroundColor) {
    console.error("[getStyles] Invalid or incomplete theme object received:", theme);
    // Return an empty object but with the right type
    return { 
      sheet: {} as ChatStyles, 
      markdown: {} 
    }; 
  }

  console.log("[getStyles] Theme properties before StyleSheet.create:", {
    textColor: theme.textColor,
    regularFont: theme.regularFont,
    tintColor: theme.tintColor,
    tintTextColor: theme.tintTextColor,
    backgroundColor: theme.backgroundColor,
    responseBackgroundColor: theme.responseBackgroundColor,
    borderColor: theme.borderColor,
    disabledColor: theme.disabledColor,
  });

  const markdownStyle = {
    body: { color: theme.textColor, fontSize: 16, fontFamily: theme.regularFont },
    heading1: { color: theme.textColor, fontFamily: theme.boldFont, fontSize: 24, marginTop: 10, marginBottom: 5 },
    heading2: { color: theme.textColor, fontFamily: theme.semiBoldFont, fontSize: 20, marginTop: 8, marginBottom: 4 },
    heading3: { color: theme.textColor, fontFamily: theme.semiBoldFont, fontSize: 18, marginTop: 6, marginBottom: 3 },
    code_block: { backgroundColor: theme.secondaryBackgroundColor, color: theme.secondaryTextColor, padding: 10, borderRadius: 4, borderColor: theme.borderColor, borderWidth: 1, fontFamily: "Courier New", marginVertical: 5 },
    fence: { backgroundColor: theme.secondaryBackgroundColor, color: theme.secondaryTextColor, padding: 10, borderRadius: 4, borderColor: theme.borderColor, borderWidth: 1, fontFamily: "Courier New", marginVertical: 5 },
    link: { color: theme.tintColor, textDecorationLine: "underline" as const },
    list_item: { marginBottom: 5 },
    bullet_list: { marginLeft: 10 },
    ordered_list: { marginLeft: 10 },
    blockquote: { backgroundColor: theme.borderColor, borderLeftColor: theme.tintColor, borderLeftWidth: 4, padding: 10, marginLeft: 5, marginVertical: 5 },
    strong: { fontFamily: theme.boldFont },
    em: { fontStyle: 'italic' as const },
  };

  try {
    console.log("[getStyles] Attempting StyleSheet.create (full)... ");
    const styles = StyleSheet.create<ChatStyles>({
      container: {
        flex: 1,
        backgroundColor: theme.backgroundColor,
      },
      userMessageOuterWrapper: {
         marginTop: 10,
         alignItems: 'flex-end',
       },
      greetingContainer: {
         justifyContent: "center",
         alignItems: "center",
         flexGrow: 1,
         paddingVertical: 50,
         paddingHorizontal: 20,
       },
      greeting: {
        fontSize: 20,
        color: theme.textColor,
        fontFamily: theme.regularFont,
        textAlign: 'center',
      },
      userMessageContainer: {
        alignSelf: "flex-end",
        marginHorizontal: 10,
        marginBottom: 5,
        maxWidth: "80%",
      },
      userMessageWrapper: {
        backgroundColor: theme.tintColor,
        padding: 10,
        borderRadius: 15,
        borderBottomRightRadius: 0,
      },
      userMessageText: {
        color: theme.tintTextColor,
        fontSize: 16,
        fontFamily: theme.regularFont,
      },
      responseContainerPressable: {
        alignSelf: 'flex-start',
        maxWidth: "90%",
        marginHorizontal: 10,
        marginBottom: 5,
      },
      responseContainer: {
        backgroundColor: theme.responseBackgroundColor || '#f0f0f0',
        padding: 10,
        borderRadius: 15,
        borderBottomLeftRadius: 0,
        alignSelf: 'flex-start',
      },
      imageStyle: {
        maxWidth: '100%',
        aspectRatio: 1,
        borderRadius: 10,
        alignSelf: 'center',
      },
      scrollContainer: {
        flex: 1,
      },
      chatInputContainer: {
        flexDirection: "row",
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: theme.borderColor,
        alignItems: "center",
        backgroundColor: theme.backgroundColor,
      },
      input: {
        flex: 1,
        padding: 10,
        marginRight: 10,
        borderWidth: 1,
        borderColor: theme.borderColor,
        borderRadius: 20,
        color: theme.textColor,
        backgroundColor: theme.inputBackgroundColor || theme.backgroundColor,
      },
      buttonStyle: {
        backgroundColor: theme.tintColor,
        padding: 10,
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 5,
      },
      imageButtonStyle: {
        backgroundColor: theme.tintColor,
        padding: 10,
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
      },
      buttonDisabled: {
        backgroundColor: "#cccccc",
        opacity: 0.6,
      },
      buttonPressed: {
        opacity: 0.8,
      },
      loadingContainer: {
         paddingVertical: 10,
         alignItems: 'center',
       },
      generatingContainer: {
         flexDirection: 'row',
         alignItems: 'center',
         justifyContent: 'center',
         paddingVertical: 10,
         borderBottomWidth: 1,
         borderBottomColor: theme.borderColor,
         backgroundColor: theme.backgroundColor,
       },
      generatingText: {
         color: theme.textColor,
         fontFamily: theme.regularFont,
         fontSize: 14,
       },
      loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
    });
    console.log("[getStyles] StyleSheet.create (full) succeeded.");
    return { sheet: styles, markdown: markdownStyle };
  } catch (error) {
    console.error("[getStyles] Error during StyleSheet.create:", error);
    return { sheet: {} as ChatStyles, markdown: markdownStyle }; 
  }
};
// --- End of getStyles --- 

// --- ADDED: Default style fallback ---
const defaultImageStyle: ImageStyle = { 
  width: width * 0.5, // 50% of screen width (smaller than before)
  height: width * 0.5, // Square aspect ratio
  borderRadius: 10, 
  alignSelf: 'center' 
};

// --- ADDED: Debug function ---
const logImageError = (error: any, imageUrl: string) => {
  console.error(`Error loading image from ${imageUrl}:`, error);
};

export function Chat() {
  console.log("--- Chat component function started ---");
  const [loading, setLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const { showActionSheetWithOptions } = useActionSheet();

  // State for AI profile
  const [aiProfile, setAiProfile] = useState({
    name: 'AI Chat',
    avatar: 'https://ui-avatars.com/api/?name=AI&background=d53f8c&color=fff&size=200'
  });

  // New state for sequential preference flow
  const [preferenceStage, setPreferenceStage] = useState<PreferenceStage>('idle');
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);

  // --- ADDED: State for image modal ---
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- ADDED: State to help force FlatList updates ---
  const [listUpdateToken, setListUpdateToken] = useState(0);

  // Track if we're seeing the first generation
  const [isFirstGeneration, setIsFirstGeneration] = useState(true);

  const [geminiResponse, setGeminiResponse] = useState<{
    messages: Message[];
    index: string;
  }>({
    messages: [],
    index: uuid(),
  });

  const { theme } = useContext(ThemeContext);

  // --- ADDED: useEffect to trigger preference flow on mount ---
  useEffect(() => {
    // Only run if messages are empty and we are in the initial idle state
    if (geminiResponse.messages.length === 0 && preferenceStage === 'idle') {
      console.log("[useEffect] No messages, triggering preference flow initiation.");
      // Set loading/requesting state immediately
      setPreferenceStage('requesting'); 
      setLoading(true);
      // Call the server to get the first question
      // Use an empty body as per Route 1 logic
      streamGeminiResponse({ messages: [] }, 'gemini'); 
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Defensive Check --- 
  // Ensure theme is valid before calling getStyles
  if (!theme || !theme.backgroundColor) {
     console.log("[Chat] Theme context not yet valid, rendering loading state.");
     return (
       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
         <ActivityIndicator />
       </View>
     );
   }
  // --- End Defensive Check ---

  // --- Call getStyles directly AFTER check --- 
  console.log("[Chat] Theme is valid, calling getStyles.");
  const { sheet, markdown } = getStyles(theme);
  
  // --- Check if styles were created successfully --- 
  if (!sheet || Object.keys(sheet).length === 0) {
    console.error("[Chat] getStyles returned empty sheet, rendering error/loading state.");
    // This might indicate the error happened inside getStyles despite the check
    return (
       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
         <Text>Error loading styles</Text>
       </View>
    );
  }
  // --- End Style Check ---

  // Convert messages to the format required by FlirtChat
  const flirtChatMessages: FlirtMessageType[] = geminiResponse.messages.map((msg, idx) => {
    let content = '';
    let image: string | undefined = undefined;
    
    if (msg.user) {
      content = msg.user;
    } else if (msg.assistant) {
      content = msg.assistant;
    }
    
    if (msg.image) {
      image = msg.image;
    }
    
    return {
      id: msg._id || `msg-${idx}`,
      sender: msg.user ? 'user' : 'assistant',
      content: content,
      image: image,
      timestamp: new Date().toISOString()
    };
  });
  
  // Function to handle sending messages from FlirtChat
  const handleSendFromFlirtChat = (message: string) => {
    setInput(''); // Clear input since FlirtChat manages its own
    // Use the existing handleSendMessage logic but with the message parameter
    const messageToSend = message.trim();
    if (!messageToSend || loading) return;
    
    // Create a new message object
    const newMessage = { user: messageToSend, _id: uuid() };
    
    // Add new message to state
    const updatedMessages = [...geminiResponse.messages, newMessage];
    
    // Update state with new message
    setGeminiResponse(prev => ({
      ...prev,
      messages: updatedMessages
    }));
    
    // Call the appropriate endpoint based on current state
    if (currentQuestionId) {
      // Handle preference answer (using existing function logic)
      setLoading(true);
      const requestBody = {
        messages: updatedMessages,
        answer: messageToSend,
        questionId: currentQuestionId
      };
      streamGeminiResponse(requestBody, 'gemini');
    } else {
      // Handle regular chat (using existing function logic)
      setLoading(true);
      const requestBody = {
        prompt: messageToSend,
        messages: geminiResponse.messages,
      };
      streamGeminiResponse(requestBody, 'gemini');
    }
  };

  async function handleSendMessage() {
    if (!input.trim() || loading) return;
    Keyboard.dismiss();

    const currentInput = input;
    setInput("");

    let requestBody: any = {};
    let endpointType = 'gemini';
    let optimisticMessages: Message[] = [];

    if (geminiResponse.messages.length === 0 && preferenceStage === 'idle') {
        console.log("[handleSendMessage] First message, initiating preference flow.");
        requestBody = { messages: [] };
        setPreferenceStage('requesting');
        setLoading(true);
        optimisticMessages = [];
    }
    else if (currentQuestionId && currentInput) {
      console.log(`[handleSendMessage] Sending answer for ${currentQuestionId}: ${currentInput.substring(0, 30)}...`);
      
      optimisticMessages = [
        ...geminiResponse.messages,
        { user: currentInput },
      ];
      setGeminiResponse(c => ({ ...c, messages: JSON.parse(JSON.stringify(optimisticMessages)) }));
      setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 1);

      requestBody = {
        messages: optimisticMessages,
        answer: currentInput,
        questionId: currentQuestionId
      };
      setLoading(true);
    } 
    else if (preferenceStage === 'chatting' || preferenceStage === 'idle' || preferenceStage === 'error') {
      console.log(`[handleSendMessage] Sending regular chat prompt: ${currentInput}`);
      console.log(`[handleSendMessage] Current message count: ${geminiResponse.messages.length}`);
      
      // Enhanced image request detection - more natural phrases
      const imageRequestPhrases = [
        /\b(show|send|get|display|pic|picture|photo|image|generate|see|view|selfie|look)/i,
        /\bwhat (do|would|will) you look like\b/i,
        /\bhow do you look\b/i,
        /\blet me see\b/i,
        /\bsee you\b/i,
        /\b(want|like) to see\b/i,
        /\bshow me (a|your|how)\b/i,
        /\b(how|what) (would|do|does) (.*) look\b/i
      ];
      
      // Check if any of the image request patterns match
      const isImageRequest = imageRequestPhrases.some(pattern => pattern.test(currentInput.toLowerCase())) && 
                            !/no (pic|picture|photo|image|selfie)/i.test(currentInput.toLowerCase());
      
      let enhancedInput = currentInput;
      if (isImageRequest) {
        // Add the explicit image generation tag for the server to detect
        console.log("[handleSendMessage] Detected natural image request, enhancing prompt");
        enhancedInput = `${currentInput} \`\`[generate_image: ${currentInput}]\`\``;
        console.log("[handleSendMessage] Enhanced image prompt:", enhancedInput);
      }
      
      // Create a copy of the user's message to add to the chat
      const newUserMessage = { 
        user: currentInput,  // Keep the original input for display
        _id: uuid() 
      };
      
      // Add only the user message to the state (server will return the assistant's response)
      optimisticMessages = [
        ...geminiResponse.messages,
        newUserMessage
      ];
      
      // Log the messages we're setting
      console.log(`[handleSendMessage] Setting ${optimisticMessages.length} messages`);
      optimisticMessages.forEach((msg, idx) => {
        if (msg.user) console.log(`[handleSendMessage] Message ${idx}: USER: ${msg.user.substring(0, 20)}...`);
        if (msg.assistant) console.log(`[handleSendMessage] Message ${idx}: ASSISTANT: ${msg.assistant.substring(0, 20)}...`);
        if (msg.image) console.log(`[handleSendMessage] Message ${idx}: IMAGE: ${msg.image}`);
      });
      
      // Update the state with the optimistic user message
      setGeminiResponse((c) => ({ 
          index: c.index,
          messages: JSON.parse(JSON.stringify(optimisticMessages)),
      }));
      
      // Sometimes we need to force a re-render
      setListUpdateToken(prev => prev + 1);
      
      // Scroll to the new message
      setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 50);

      // Prepare the request body with the full conversation history
      // But use the enhanced input with the image tag hint
      requestBody = {
        prompt: enhancedInput,
        messages: geminiResponse.messages,
        // Flag to tell the server this might be an image request
        is_potential_image_request: isImageRequest,
      };
      setLoading(true);
    } else {
        console.warn(`[handleSendMessage] Message ignored, preference stage is '${preferenceStage}'`);
        setInput(currentInput);
        return;
    }
    
    await streamGeminiResponse(requestBody, endpointType);
  }

  async function streamGeminiResponse(requestBody: any, endpointType: string) {
    let localResponseAccumulator = "";
    let currentAssistantMessageId: string | null = null;

    try {
      if (Object.keys(requestBody).length === 0 && requestBody.constructor === Object && geminiResponse.messages.length > 0) {
           console.warn("[streamGeminiResponse] Request body is empty but messages exist, aborting SSE connection attempt.");
           setLoading(false);
           return;
       }

      console.log("[streamGeminiResponse] Connecting to SSE with body:", requestBody);
      const es = await getEventSource({
        body: requestBody,
        type: endpointType,
      });

      const listener = (event: any) => {
        if (event.type === "open") {
          console.log("[SSE] Open connection.");
        } else if (event.type === "message") {
          if (event.data === "[DONE]") {
             console.log("[SSE] DONE received.");
             setLoading(false);
             setPreferenceStage(prevStage => {
                 console.log(`[SSE DONE] Current stage: ${prevStage}`);
                 if (prevStage === 'generating') {
                     console.log("[SSE DONE] Switching stage from generating to chatting.");
                     return 'chatting';
                 }
                 return prevStage; 
             });
 
             // Don't reset the localResponseAccumulator here
             // localResponseAccumulator = "";
             currentAssistantMessageId = null;
             es.close();
             setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 50);
             return;
          }

          let parsedData;
          try {
            parsedData = JSON.parse(event.data);
          } catch (parseError) {
            console.error("Error parsing SSE data:", parseError, "Raw Data:", event.data);
            parsedData = event.data; 
          }

          if (typeof parsedData === 'object' && parsedData !== null) {
             if (parsedData.action === "ask_preference" && parsedData.question && parsedData.questionId) {
                console.log(`[SSE] Received question: ${parsedData.questionId}`);
                
                // Check if this is a duplicate of the very first question
                const isFirstQuestion = parsedData.questionId === "userName";
                const alreadyHasFirstQuestion = geminiResponse.messages.length > 0 && 
                    geminiResponse.messages[0].assistant && 
                    geminiResponse.messages[0].assistant.includes("First, what's your name?");
                
                // Only skip if it's the first question AND we already have it
                const shouldSkip = isFirstQuestion && alreadyHasFirstQuestion;
                
                if (!shouldSkip) {
                    console.log(`[SSE] Adding preference question: ${parsedData.questionId}`);
                    setGeminiResponse(prevState => ({
                        ...prevState,
                        messages: [...prevState.messages, { assistant: parsedData.question, _id: uuid() }] 
                    }));
                } else {
                    console.log(`[SSE] Skipping duplicate first question`);
                }
                
                setCurrentQuestionId(parsedData.questionId);
                setPreferenceStage(parsedData.questionId as PreferenceStage);
                setLoading(false);
                es.close();
                setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 50);
             } else if (parsedData.action === "generating_flirt") {
                 console.log("[SSE] Received generating_flirt action.");
                 // Remove creating empty message placeholder
                 // const newMessageId = uuid();
                 
                 // Don't create an empty placeholder message - the FlirtChat typing indicator handles this
                 // setGeminiResponse(prevState => ({
                 //    ...prevState,
                 //    messages: [...prevState.messages, { assistant: "", _id: newMessageId }] 
                 // }));
                 // currentAssistantMessageId = newMessageId;
                 
                 setPreferenceStage('generating');
             } else if (parsedData.error) {
                 console.error("[SSE] Received error object:", parsedData.error);
                 const errorText = `⚠️ Server Error: ${parsedData.error}`;
                 setGeminiResponse(prevState => {
                     const messagesCopy = JSON.parse(JSON.stringify(prevState.messages));
                     if (messagesCopy.length > 0 && messagesCopy[messagesCopy.length - 1]?.assistant !== undefined) {
                         messagesCopy[messagesCopy.length - 1].assistant += `\n${errorText}`;
                     } else {
                         messagesCopy.push({ assistant: errorText });
                     }
                     return { ...prevState, messages: messagesCopy };
                 });
                 setLoading(false);
                 setPreferenceStage('error');
                 es.close();
             } else if (parsedData.final_update === true) {
                 console.log("[SSE] Received final_update instruction:", parsedData);
                 const finalText = parsedData.text || ""; // Get final text (includes potential error)
                 
                 // Always log the final text for debugging
                 console.log("[SSE Final Update] Final text:", finalText.substring(0, 100) + "...");
                 
                 // Set the localResponseAccumulator to the finalText
                 localResponseAccumulator = finalText;
                 
                 // Check if this is empty
                 if (!localResponseAccumulator.trim()) {
                     console.warn("[SSE Final Update] Received empty text content, setting placeholder");
                     localResponseAccumulator = "I'm here! What would you like to talk about?";
                 }
                 
                 // Check if this is the first message and try to extract name
                 if (isFirstGeneration && finalText.length > 0) {
                   console.log("[SSE Final] Checking for AI name in complete message");
                   // Look for common name introduction patterns
                   const namePatterns = [
                     /I\s*(?:'|a)m\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /[Mm]y name is\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /[Cc]all me\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /I go by\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /name(?:'|)s\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /I'm\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /known as\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /This is\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /you can call me\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /It'?s\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                     /Hey.*?[,!]?\s+(?:I'?m|I am|This is|It'?s)\s+(.*?)(?:,|\.|\!|\s+and|\n)/i
                   ];
                   
                   let foundName = false;
                   for (const pattern of namePatterns) {
                     const match = finalText.match(pattern);
                     if (match && match[1]) {
                       // Extract name and clean it up
                       let aiName = match[1].trim();
                       
                       // Skip common phrases that aren't actually names
                       const nonNamePhrases = ['here', 'your', 'the', 'a', 'an', 'this', 'that', 'just', 'so', 'going to', 'happy', 'excited', 'glad', 'pleased'];
                       if (nonNamePhrases.some(phrase => aiName.toLowerCase().startsWith(phrase))) {
                         continue;
                       }
                       
                       // If name is too long, take just the first word or limit to 15 chars
                       if (aiName.length > 15) {
                         aiName = aiName.split(/\s+/)[0];
                       }
                       
                       // Update AI name if found
                       if (aiName && aiName.length > 1) {
                         console.log("[SSE Final] Extracted AI name from intro:", aiName);
                         setAiProfile(prev => ({
                           ...prev,
                           name: aiName
                         }));
                         foundName = true;
                         break; // Stop after finding first valid name
                       }
                     }
                   }
                   
                   // If no name found using patterns, try to find the first capitalized word that could be a name
                   if (!foundName) {
                     const words = finalText.split(/\s+/);
                     for (const word of words) {
                       // Find a word that starts with capital letter, has 3+ chars, and isn't at beginning of sentence
                       if (word.length >= 3 && /^[A-Z][a-z]+$/.test(word) && 
                           !['I', 'My', 'Hi', 'Hello', 'Hey', 'The', 'This', 'That'].includes(word)) {
                         console.log("[SSE Final] Extracted capitalized name from intro:", word);
                         setAiProfile(prev => ({
                           ...prev,
                           name: word
                         }));
                         break;
                       }
                     }
                   }
                   
                   setIsFirstGeneration(false); // Mark first generation as complete
                 }
                 
                 // Pattern to look for empty backticks that might indicate an attempted image 
                 // The model sometimes tries to use `` or ``` as image placeholders
                 const containsEmptyBackticks = /(?:``|```)\s*(?:``|```)/g.test(finalText);
                 const mentionsImage = /\b(?:picture|image|photo|look|see|here)\b/i.test(finalText);
                 
                 // Is this likely an incomplete image response?
                 const likelyImageAttempt = (containsEmptyBackticks && mentionsImage) || 
                                          requestBody.is_potential_image_request === true;
                 
                 if (likelyImageAttempt) {
                     console.log("[SSE Final Update] Response contains empty backticks, likely intended for image");
                     
                     // Suggest triggering image generation if relevant
                     const imageHint = "\n\n(If you were expecting an image, please try asking with the phrase 'show me a picture' or 'generate an image')";
                     console.log("[SSE Final Update] Adding image hint");
                     
                     // Add a hint to the final text
                     // Only if this wasn't already an explicit image request with the right hint
                     if (!requestBody.is_potential_image_request) {
                         localResponseAccumulator = finalText + imageHint;
                     } else {
                         localResponseAccumulator = finalText;
                     }
                 } else {
                     localResponseAccumulator = finalText; // Update local accumulator with final text
                 }

                 // Check for image generation tags in the text (may be hidden in the response)
                 const containsImageTag = /\[\s*generate_image\s*:\s*([^\]]+)\]/i.test(finalText);
                 console.log("[SSE Final Update] Contains image tag:", containsImageTag);

                 setGeminiResponse(prevState => {
                     const messagesCopy = JSON.parse(JSON.stringify(prevState.messages));
                     
                     // Is this a chat message or part of the preference/introduction flow?
                     const isRegularChatMessage = prevState.messages.length > 0 && 
                                               prevState.messages[prevState.messages.length - 1].user !== undefined;
                     
                     console.log("[SSE Final Update] Is regular chat message:", isRegularChatMessage);
                     
                     // If this is the very first message in an empty chat, it's likely the introduction
                     const isFirstIntro = prevState.messages.length === 0;
                     console.log("[SSE Final Update] Is first intro:", isFirstIntro);
                     
                     if (isRegularChatMessage) {
                         // For chat responses to user messages, add a new assistant message
                         // Only add a message if we have content
                         if (localResponseAccumulator && localResponseAccumulator.trim().length > 0) {
                             const newAssistantMessage = {
                                 assistant: localResponseAccumulator,
                                 _id: uuid()
                             };
                             messagesCopy.push(newAssistantMessage);
                         } else {
                             console.warn("[SSE Final Update] Skipped adding empty message");
                         }
                     } else if (messagesCopy.length > 0) {
                         // For preference flow or intro, update the last message
                         const lastMessageIndex = messagesCopy.length - 1;
                         
                         // Only update if the last message is from the assistant
                         if (messagesCopy[lastMessageIndex].assistant !== undefined) {
                             messagesCopy[lastMessageIndex] = {
                                ...messagesCopy[lastMessageIndex],
                                assistant: localResponseAccumulator,
                                image: messagesCopy[lastMessageIndex].image // Preserve existing image if any
                             };
                             console.log("[SSE Final Update] Updated last assistant message TEXT");
                         } else {
                             // If last message is not from assistant, add a new one
                             messagesCopy.push({
                                 assistant: localResponseAccumulator,
                                 _id: uuid()
                             });
                             console.log("[SSE Final Update] Last message not from assistant, added new one");
                         }
                     } else if (isFirstIntro) {
                         // Make sure we have content before adding the message
                         if (localResponseAccumulator && localResponseAccumulator.trim().length > 0) {
                             messagesCopy.push({ 
                                 assistant: localResponseAccumulator,
                                 _id: uuid()
                             });
                         } else {
                             // Use fallback for empty intro text
                             messagesCopy.push({ 
                                 assistant: "Hello! I'm here to chat with you. What would you like to talk about?",
                                 _id: uuid()
                             });
                         }
                     } else {
                         console.warn("[SSE Final Update] Messages array was empty, adding new text message.");
                         messagesCopy.push({ 
                            assistant: localResponseAccumulator,
                            _id: uuid()
                         });
                     }
                     
                     console.log("[SSE Final Update] Messages count after update:", messagesCopy.length);
                     console.log("[SSE Final Update] Message content:", localResponseAccumulator.substring(0, 50));
                     
                     // Create a new reference to ensure React detects the change
                     const freshMessages = [...messagesCopy];
                     
                     return { 
                         ...prevState, 
                         messages: freshMessages,
                         index: prevState.index 
                     };
                 });

                 // Increment update token to ensure re-render after text update
                 setListUpdateToken(t => t + 1); 
                 // Scroll to end after text update
                 setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: false }); }, 50);

             // --- Handler for the new separate image message ---
             } else if (parsedData.new_image_message === true && parsedData.image) {
                 console.log("[SSE] Received new_image_message instruction:", parsedData);
                 const imageUrl = parsedData.image;
                 const newImageMsg = { image: imageUrl, _id: uuid() };

                 // Check if this is the first image received and use it as profile pic
                 const isFirstImage = !geminiResponse.messages.some(msg => msg.image);
                 if (isFirstImage) {
                   console.log("[SSE] Setting first image as AI profile picture:", imageUrl);
                   setAiProfile(prev => ({
                     ...prev,
                     avatar: imageUrl
                   }));
                 }
                 
                 setGeminiResponse(prevState => ({
                     ...prevState,
                     messages: [...prevState.messages, newImageMsg]
                 }));

                 console.log("[SSE New Image] Added new image message:", newImageMsg);
                 
                 // Force a render update
                 setListUpdateToken(t => t + 1);
             } else {
                 console.warn("[SSE] Received unexpected object structure:", parsedData);
             }
          } else if (typeof parsedData === 'string') {
              console.log("[SSE Text] Text chunk received, setting stage to 'chatting'.");
              setPreferenceStage('chatting'); 

              localResponseAccumulator += parsedData;
              
              // If this is the first complete response and contains an introduction, try to extract the AI's name
              if (isFirstGeneration && localResponseAccumulator.length > 30) {
                // Look for common name introduction patterns
                const namePatterns = [
                  /I\s*(?:'|a)m\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /[Mm]y name is\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /[Cc]all me\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /I go by\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /name(?:'|)s\s*(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /I'm\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /known as\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /This is\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /you can call me\s+(.*?)(?:,|\.|!|\s+and|\n)/i,
                  /It'?s\s+(.*?)(?:,|\.|!|\s+and|\n)/i, // Add pattern to catch "It's Lily!"
                  /Hey.*?[,!]?\s+(?:I'?m|I am|This is|It'?s)\s+(.*?)(?:,|\.|\!|\s+and|\n)/i // Catch complex greetings
                ];
                
                let foundName = false;
                for (const pattern of namePatterns) {
                  const match = localResponseAccumulator.match(pattern);
                  if (match && match[1]) {
                    // Extract name and clean it up
                    let aiName = match[1].trim();
                    
                    // Skip common phrases that aren't actually names
                    const nonNamePhrases = ['here', 'your', 'the', 'a', 'an', 'this', 'that', 'just', 'so', 'going to', 'happy', 'excited', 'glad', 'pleased'];
                    if (nonNamePhrases.some(phrase => aiName.toLowerCase().startsWith(phrase))) {
                      continue;
                    }
                    
                    // If name is too long, take just the first word or limit to 15 chars
                    if (aiName.length > 15) {
                      aiName = aiName.split(/\s+/)[0];
                    }
                    
                    // Update AI name if found
                    if (aiName && aiName.length > 1) {
                      console.log("[SSE] Extracted AI name from intro:", aiName);
                      setAiProfile(prev => ({
                        ...prev,
                        name: aiName
                      }));
                      foundName = true;
                      break; // Stop after finding first valid name
                    }
                  }
                }
                
                // If no name found using patterns, try to find the first capitalized word that could be a name
                if (!foundName) {
                  const words = localResponseAccumulator.split(/\s+/);
                  for (const word of words) {
                    // Find a word that starts with capital letter, has 3+ chars, and isn't at beginning of sentence
                    if (word.length >= 3 && /^[A-Z][a-z]+$/.test(word) && 
                        !['I', 'My', 'Hi', 'Hello', 'Hey', 'The', 'This', 'That'].includes(word)) {
                      console.log("[SSE] Extracted capitalized name from intro:", word);
                      setAiProfile(prev => ({
                        ...prev,
                        name: word
                      }));
                      break;
                    }
                  }
                }
                
                setIsFirstGeneration(false); // Mark first generation as complete
              }
              
              if (localResponseAccumulator.length < 850) {
                 scrollViewRef.current?.scrollToEnd({ animated: false });
              }

              // Check if this is a response to a user message
              const isUserMessageResponse = geminiResponse.messages.length > 0 && 
                                         geminiResponse.messages[geminiResponse.messages.length - 1].user !== undefined;
              
              setGeminiResponse(prevState => {
                   const messagesCopy = JSON.parse(JSON.stringify(prevState.messages));
                   
                   if (isUserMessageResponse) {
                       // For responses to user messages, add a new message
                       if (messagesCopy.length > 0 && 
                          messagesCopy[messagesCopy.length - 1].assistant === "") {
                           // Update the placeholder message if it exists
                           messagesCopy[messagesCopy.length - 1].assistant = localResponseAccumulator;
                       } else {
                           // Otherwise, add a new assistant message
                           messagesCopy.push({ 
                              assistant: localResponseAccumulator, 
                              _id: uuid() 
                           });
                       }
                   }
                   else if (messagesCopy.length > 0) {
                       // For other cases (like intro), update the last message
                       const lastMessageIndex = messagesCopy.length - 1;
                       messagesCopy[lastMessageIndex] = { 
                          ...messagesCopy[lastMessageIndex],
                          assistant: localResponseAccumulator
                       };
                   } else {
                       console.warn("[SSE Text] Messages array was empty, adding new message with text.");
                       messagesCopy.push({ assistant: localResponseAccumulator });
                   }
                   return { ...prevState, messages: messagesCopy };
              });
          } else {
             console.warn("[SSE] Received unexpected data type:", typeof parsedData, event.data);
          }

        } else if (event.type === "error") {
          console.error("SSE Connection error:", event.message || event);
           const errorText = `⚠️ Connection Error. Please check your network or restart the chat.`;
           setGeminiResponse(prevState => {
               const messagesCopy = JSON.parse(JSON.stringify(prevState.messages));
               if (messagesCopy.length > 0 && messagesCopy[messagesCopy.length - 1]?.assistant !== undefined) {
                   messagesCopy[messagesCopy.length - 1].assistant = (messagesCopy[messagesCopy.length - 1].assistant || "") + `
${errorText}`;
               } else {
                   messagesCopy.push({ assistant: errorText });
               }
               return { ...prevState, messages: messagesCopy };
           });
           setLoading(false);
           setPreferenceStage('error');
           es.close();
        }
      };

      es.addEventListener("open", listener);
      es.addEventListener("message", listener);
      es.addEventListener("error", listener);

    } catch (error) {
      console.error("Failed to get event source:", error);
      const errorMsg = "⚠️ Failed to connect to the chat service.";
       setGeminiResponse(prevState => {
           const messagesCopy = JSON.parse(JSON.stringify(prevState.messages));
            if (messagesCopy.length > 0 && messagesCopy[messagesCopy.length - 1]?.assistant !== undefined) {
               messagesCopy[messagesCopy.length - 1].assistant = (messagesCopy[messagesCopy.length - 1].assistant || "") + `
${errorMsg}`;
            } else {
               messagesCopy.push({ assistant: errorMsg });
            }
           return { ...prevState, messages: messagesCopy };
       });
      setLoading(false);
      setPreferenceStage('error');
    }
  }

  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text);
  }

  // Function to handle image tapping
  const handleImageTap = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setModalVisible(true);
  };

  async function showClipboardActionsheet(text: string, image?: string) {
    const options: string[] = [];
    if (text) {
      options.push("Copy Text");
    }
    if (image) {
      options.push("Save Image");
    }
    options.push("Clear Chat");
    options.push("Cancel");

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf("Clear Chat");

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
      },
      async (selectedIndex?: number) => {
        if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) {
          return;
        }

        const selectedOption = options[selectedIndex];

        if (selectedOption === "Copy Text") {
          copyToClipboard(text);
        } else if (selectedOption === "Save Image") {
          console.log("Save Image action selected.");
          if (image) {
            await downloadImageToDevice(image);
          } else {
            alert("No image to save.");
          }
        } else if (selectedOption === "Clear Chat") {
          clearChat();
        }
      }
    );
  }

  async function downloadImageToDevice(url: string) {
    try {
      const FileSystem = require('expo-file-system');
      const fileUri = FileSystem.documentDirectory + uuid() + ".jpg";
      console.log(`Downloading image from ${url} to: ${fileUri}`);
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      console.log("Finished downloading to ", uri);

      alert("Image saved to app files.");
    } catch (e) {
      console.error("Error downloading/saving image:", e);
      alert("Failed to download image.");
    }
  }

  async function clearChat() {
    if (loading) return;
    console.log("Clearing chat...");
    setGeminiResponse({ messages: [], index: uuid() });
    setInput("");
    setCurrentQuestionId(null);
    setPreferenceStage('idle');
  }

  function renderItem({ item, index }: { item: Message, index: number }) {
    // Debug message content
    console.log(`[renderItem] Rendering item #${index}:`, 
                item.user ? `USER: ${item.user.substring(0, 20)}...` : 
                item.assistant ? `ASSISTANT: ${item.assistant.substring(0, 20)}...` : 
                item.image ? `IMAGE: ${item.image.substring(0, 30)}...` : 'EMPTY');
    
    // Render USER message
    if (item.user) {
      return (
        <View style={sheet.userMessageOuterWrapper}>
          <View style={sheet.userMessageContainer}>
            <View style={sheet.userMessageWrapper}>
              <Text style={sheet.userMessageText}>
                {item.user}
              </Text>
            </View>
          </View>
        </View>
      );
    }
    
    // Render ASSISTANT message (text or image)
    else if (item.assistant !== undefined || item.image) { 
      const hasText = item.assistant && item.assistant.trim().length > 0;
      const hasImage = !!item.image;

      if (!hasText && !hasImage && preferenceStage !== 'generating') { 
          console.warn(`[renderItem] Item #${index} has no content to display and not in generating stage`);
          return null;
      }

      // --- Handle image-only message separately --- 
      if (!hasText && hasImage) {
        console.log(`[renderItem] Rendering image-only message #${index}. Image URL:`, item.image);
        return (
          <View style={{ 
            alignSelf: 'flex-start', 
            marginHorizontal: 10, 
            marginVertical: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: '#111', 
            borderRadius: 12,
            padding: 4,
            overflow: 'hidden'
          }}> 
            <Pressable onPress={() => handleImageTap(item.image || '')}>
              <Image
                source={{ uri: item.image }}
                style={defaultImageStyle}
                resizeMode="cover"
                onError={(e) => logImageError(e, item.image || 'unknown')}
                testID="image-message"
              />
            </Pressable>
          </View>
        );
      }
      
      // --- Render text message (possibly with image) --- 
      console.log(`[renderItem] Rendering text message #${index}${hasImage ? ' with image' : ''}`);
      return (
        <Pressable
          onLongPress={() => showClipboardActionsheet(item.assistant || '', item.image)}
          style={sheet.responseContainerPressable}
          disabled={!hasText && !hasImage}
        >
          <View style={sheet.responseContainer}>
            {hasText ? (
              <Markdown style={markdown}>
                {item.assistant || ''}
              </Markdown>
            ) : null}
            {hasImage ? (
              <Pressable onPress={() => handleImageTap(item.image || '')}>
                <Image
                  source={{ uri: item.image }}
                  style={{
                    width: width * 0.5,
                    height: width * 0.5,
                    borderRadius: 10,
                    marginTop: hasText ? 10 : 0,
                    alignSelf: 'center'
                  }}
                  resizeMode="cover"
                  onError={(e) => logImageError(e, item.image || 'unknown')}
                  testID="response-image"
                />
              </Pressable>
            ) : null}
            {!hasText && !hasImage && preferenceStage === 'generating' ? (
              <ActivityIndicator size="small" color={theme.tintColor} style={{ padding: 10 }} />
            ) : null}
          </View>
        </Pressable>
      );
    }
    
    console.warn(`[renderItem] Item #${index} doesn't match any rendering condition:`, JSON.stringify(item));
    return null;
  }

  async function handleGenerateImage() {
    if (!input.trim() || loading) return;
    Keyboard.dismiss();

    // Store the current input and clear it
    const currentInput = input;
    setInput("");

    // Add a user message with the input text
    const newUserMessage = { 
      user: currentInput,
      _id: uuid() 
    };
    
    const optimisticMessages = [
      ...geminiResponse.messages,
      newUserMessage
    ];
    
    // Update UI with the user message
    setGeminiResponse((c) => ({ 
      index: c.index,
      messages: JSON.parse(JSON.stringify(optimisticMessages)),
    }));
    
    // Scroll to the new message
    setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 50);
    
    // Set loading state
    setLoading(true);
    
    // Create a request body with explicit image generation tag
    const enhancedInput = `${currentInput} \`\`[generate_image: ${currentInput}]\`\``;
    const requestBody = {
      prompt: enhancedInput,
      messages: geminiResponse.messages,
      is_potential_image_request: true,
    };
    
    // Send the request
    await streamGeminiResponse(requestBody, 'gemini');
  }

  return (
    <View style={sheet.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlirtChat
          messages={flirtChatMessages}
          onSendMessage={handleSendFromFlirtChat}
          aiProfile={aiProfile}
          isGenerating={loading}
          isFirstMessage={geminiResponse.messages.length === 0}
        />
      </KeyboardAvoidingView>

      {/* Full Screen Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setModalVisible(false)}
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={{
                width: width * 0.9,
                height: width * 0.9,
                borderRadius: 5,
              }}
              resizeMode="contain"
            />
          )}
          <Text style={{ 
            color: 'white', 
            position: 'absolute',
            bottom: 40,
            opacity: 0.8,
            fontFamily: theme.regularFont 
          }}>
            Tap anywhere to close
          </Text>
        </Pressable>
      </Modal>
    </View>
  );
}
