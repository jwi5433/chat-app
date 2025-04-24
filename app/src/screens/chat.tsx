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
  Platform,
} from "react-native";
import "react-native-get-random-values";
import { useContext, useState, useRef, useEffect, useMemo } from "react";
import { ThemeContext } from "../context";
import { getEventSource, callImageGenerationEndpoint, ensureCompleteImageUrl } from "../utils";
import { v4 as uuid } from "uuid";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useActionSheet } from "@expo/react-native-action-sheet";
import Markdown from "@ronradtke/react-native-markdown-display";
import { ITheme } from "../../types";
import FlirtChat, { MessageType } from '../components/FlirtChat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { AntDesign, Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { DOMAIN } from "../../constants";

// Mock router and useFocusEffect since expo-router is not available
const router = {
  push: (route: string) => console.log(`Navigate to: ${route}`),
  back: () => console.log('Navigate back')
};

const useFocusEffect = (callback: () => void) => {
  useEffect(() => {
    callback();
    return () => {};
  }, []);
};

// Define FlirtMessageType based on the MessageType from FlirtChat
export type FlirtMessageType = MessageType;

// Define local types that were previously imported
type GeminiResponse = {
  messages: Message[];
};

type Message = {
  user?: string;
  assistant?: string;
  image?: string;
  _id?: string;
};

const { width } = Dimensions.get("window");

type PreferenceStage =
  | "idle"
  | "requesting"
  | "userName"
  | "partnerSex"
  | "partnerLooks"
  | "partnerTraits"
  | "userInterests"
  | "generating"
  | "chatting"
  | "error";

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

interface StylesResult {
  sheet: ChatStyles;
  markdown: any;
}

const getStyles = (theme: ITheme): StylesResult => {
  if (!theme || typeof theme !== "object" || !theme.backgroundColor) {
    console.error(
      "[getStyles] Invalid or incomplete theme object received:",
      theme
    );

    return {
      sheet: {} as ChatStyles,
      markdown: {},
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
    body: {
      color: theme.textColor,
      fontSize: 16,
      fontFamily: theme.regularFont,
    },
    heading1: {
      color: theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 24,
      marginTop: 10,
      marginBottom: 5,
    },
    heading2: {
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 20,
      marginTop: 8,
      marginBottom: 4,
    },
    heading3: {
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      marginTop: 6,
      marginBottom: 3,
    },
    code_block: {
      backgroundColor: theme.secondaryBackgroundColor,
      color: theme.secondaryTextColor,
      padding: 10,
      borderRadius: 4,
      borderColor: theme.borderColor,
      borderWidth: 1,
      fontFamily: "Courier New",
      marginVertical: 5,
    },
    fence: {
      backgroundColor: theme.secondaryBackgroundColor,
      color: theme.secondaryTextColor,
      padding: 10,
      borderRadius: 4,
      borderColor: theme.borderColor,
      borderWidth: 1,
      fontFamily: "Courier New",
      marginVertical: 5,
    },
    link: { color: theme.tintColor, textDecorationLine: "underline" as const },
    list_item: { marginBottom: 5 },
    bullet_list: { marginLeft: 10 },
    ordered_list: { marginLeft: 10 },
    blockquote: {
      backgroundColor: theme.borderColor,
      borderLeftColor: theme.tintColor,
      borderLeftWidth: 4,
      padding: 10,
      marginLeft: 5,
      marginVertical: 5,
    },
    strong: { fontFamily: theme.boldFont },
    em: { fontStyle: "italic" as const },
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
        alignItems: "flex-end",
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
        textAlign: "center",
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
        alignSelf: "flex-start",
        maxWidth: "90%",
        marginHorizontal: 10,
        marginBottom: 5,
      },
      responseContainer: {
        backgroundColor: theme.responseBackgroundColor || "#f0f0f0",
        padding: 10,
        borderRadius: 15,
        borderBottomLeftRadius: 0,
        alignSelf: "flex-start",
      },
      imageStyle: {
        maxWidth: "100%",
        aspectRatio: 1,
        borderRadius: 10,
        alignSelf: "center",
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
        alignItems: "center",
      },
      generatingContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
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
        justifyContent: "center",
        alignItems: "center",
      },
    });
    console.log("[getStyles] StyleSheet.create (full) succeeded.");
    return { sheet: styles, markdown: markdownStyle };
  } catch (error) {
    console.error("[getStyles] Error during StyleSheet.create:", error);
    return { sheet: {} as ChatStyles, markdown: markdownStyle };
  }
};

const defaultImageStyle: ImageStyle = {
  width: width * 0.5,
  height: width * 0.5,
  borderRadius: 10,
  alignSelf: "center",
};

const logImageError = (error: any, imageUrl: string) => {
  console.error(`Error loading image from ${imageUrl}:`, error.nativeEvent?.error || error);
  
  // Check if this is a relative URL that needs the domain prefixed
  if (imageUrl && typeof imageUrl === 'string') {
    if (imageUrl.startsWith('/images/') && !imageUrl.startsWith('http')) {
      console.log('Image URL appears to be a relative path. It may need the domain prepended.');
      // This might indicate that DOMAIN wasn't properly added to the URL
    } else if (imageUrl.includes('files/')) {
      // For proxied Fooocus images
      console.log('This appears to be a Fooocus image path. Checking proxy configuration.');
    }
  }
};

export function Chat() {
  console.log("--- Chat component function started ---");
  const [loading, setLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const scrollViewRef = useRef<any>(null);
  const { showActionSheetWithOptions } = useActionSheet();
  const { getToken } = useAuth();

  const [aiProfile, setAiProfile] = useState({
    name: "AI Chat",
    avatar: "https:",
  });

  const [preferenceStage, setPreferenceStage] =
    useState<PreferenceStage>("idle");
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
    null
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [listUpdateToken, setListUpdateToken] = useState(0);

  const [isFirstGeneration, setIsFirstGeneration] = useState(true);

  const [geminiResponse, setGeminiResponse] = useState<{
    messages: Message[];
    index: string;
  }>({
    messages: [],
    index: uuid(),
  });

  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    if (geminiResponse.messages.length === 0 && preferenceStage === 'idle') {
      console.log("[useEffect] No messages, triggering preference flow initiation.");
      setPreferenceStage("requesting");
      setLoading(true);

      // Get token and start chat
      const initChat = async () => {
        try {
          const token = await getToken();
          if (!token) {
            console.error("No authentication token available");
            setError("Authentication error. Please try signing in again.");
            setLoading(false);
            return;
          }
          await streamGeminiResponse({ messages: [] }, "gemini", token);
        } catch (err) {
          console.error("Error initializing chat:", err);
          setError("Failed to initialize chat. Please try again.");
          setLoading(false);
        }
      };
      initChat();
    }
  }, []);

  if (!theme || !theme.backgroundColor) {
    console.log("[Chat] Theme context not yet valid, rendering loading state.");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  console.log("[Chat] Theme is valid, calling getStyles.");
  const { sheet, markdown } = getStyles(theme);

  if (!sheet || Object.keys(sheet).length === 0) {
    console.error(
      "[Chat] getStyles returned empty sheet, rendering error/loading state."
    );

    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error loading styles</Text>
      </View>
    );
  }

  const scrollToEnd = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !(geminiResponse.messages.length === 0 && preferenceStage === 'idle')) {
      console.log("[handleSendMessage] Message ignored: No text input and not initial request.");
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        console.error("No authentication token available");
        setError("Authentication error. Please try signing in again.");
        return;
      }

      Keyboard.dismiss();

      const currentInput = input.trim();
      let optimisticMessages: Message[] = [];
      let isImageRequest = false;

      const imageRequestPhrases = [
        /\b(show|send|get|display|pic|picture|photo|image|generate|see|view|selfie|look)/i,
        /\bwhat (do|would|will) you look like\b/i,
        /\bhow do you look\b/i,
        /\blet me see\b/i,
        /\bsee you\b/i,
        /\b(want|like) to see\b/i,
        /\bshow me (a|your|how)\b/i,
        /\b(how|what) (would|do|does) (.*) look\b/i,
      ];
      isImageRequest =
        imageRequestPhrases.some((pattern) =>
          pattern.test(currentInput.toLowerCase())
        ) &&
        !/no (pic|picture|photo|image|selfie)/i.test(currentInput.toLowerCase());

      if (geminiResponse.messages.length === 0 && preferenceStage === 'idle' && currentInput) {
        console.log("[handleSendMessage] First message with input, initiating preference flow.");
        setPreferenceStage('requesting');
        setLoading(true);
        await streamGeminiResponse({ messages: [{ user: currentInput }], prompt: currentInput }, 'gemini', token);
        return;
      }
      else if (currentQuestionId && currentInput) {
        console.log(`[handleSendMessage] Sending answer for ${currentQuestionId}: ${currentInput.substring(0, 30)}...`);

        const newUserMessage = { user: currentInput, _id: uuid() };
        optimisticMessages = [...geminiResponse.messages, newUserMessage];
        setGeminiResponse(c => ({ ...c, messages: JSON.parse(JSON.stringify(optimisticMessages)) }));
        setTimeout(scrollToEnd, 50);
        setListUpdateToken(prev => prev + 1);

        setLoading(true);
        setInput("");

        const requestBody = {
            messages: JSON.parse(JSON.stringify(optimisticMessages)),
            answer: currentInput,
            questionId: currentQuestionId
        };

        await streamGeminiResponse(requestBody, 'gemini', token);
        return;
      }
      else if ((preferenceStage === 'chatting' || preferenceStage === 'idle' || preferenceStage === 'error') && currentInput) {
        console.log("[handleSendMessage] Handling general chat or potential image request.");

        const userMessageContent = currentInput;
        const newUserMessage: Message = { user: userMessageContent, _id: uuid() };
        optimisticMessages = [...geminiResponse.messages, newUserMessage];

        setGeminiResponse(c => ({
            ...c,
            messages: JSON.parse(JSON.stringify(optimisticMessages)),
        }));

        setTimeout(scrollToEnd, 50);
        setListUpdateToken(prev => prev + 1);

        setLoading(true);
        setInput("");

        if (isImageRequest) {
          console.log("[handleSendMessage] Text-based image request detected. Calling image generation.");
          try {
            const imageResultUrl = await callImageGenerationEndpoint(currentInput, undefined, token);
            
            if (imageResultUrl && typeof imageResultUrl === 'string') {
              console.log("[handleSendMessage] Received image URL:", imageResultUrl.substring(0, 50) + "...");
              setGeminiResponse(c => {
                const messagesCopy = JSON.parse(JSON.stringify(c.messages));
                messagesCopy.push({ image: imageResultUrl, _id: uuid() });
                return { ...c, messages: messagesCopy };
              });
              setListUpdateToken(prev => prev + 1);
              setTimeout(scrollToEnd, 50);
            } else {
              setGeminiResponse(c => {
                const messagesCopy = JSON.parse(JSON.stringify(c.messages));
                messagesCopy.push({ assistant: "Error generating image.", _id: uuid() });
                return { ...c, messages: messagesCopy };
              });
              setListUpdateToken(prev => prev + 1);
              setTimeout(scrollToEnd, 50);
            }
          } catch (error: any) {
            console.error("[handleSendMessage] Error during image generation call:", error);
            const errorMessage = error.message || "An unknown error occurred.";
            setGeminiResponse(c => {
              const messagesCopy = JSON.parse(JSON.stringify(c.messages));
              messagesCopy.push({ assistant: `An error occurred during image generation: ${errorMessage}`, _id: uuid() });
              return { ...c, messages: messagesCopy };
            });
            setListUpdateToken(prev => prev + 1);
            setTimeout(scrollToEnd, 50);
          } finally {
            setLoading(false);
            console.log("[handleSendMessage] Image generation process concluded.");
          }
        } else {
          console.log("[handleSendMessage] Not an image request. Calling Gemini endpoint for text chat.");
          const requestBody = {
              prompt: currentInput,
              messages: JSON.parse(JSON.stringify(optimisticMessages))
          };

          await streamGeminiResponse(requestBody, 'gemini', token);

          console.log("[handleSendMessage] Regular text chat process concluded.");
        }
      } else {
        console.warn(`[handleSendMessage] Message ignored: Not in a handling state and no input.`);
      }
    } catch (err) {
      console.error("Error in handleSendMessage:", err);
      setError("Failed to send message. Please try again.");
    }
  };

  async function streamGeminiResponse(requestBody: any, endpointType: string, token: string) {
    let localResponseAccumulator = "";
    let currentAssistantMessageId: string | null = null;

    try {
      if (
        Object.keys(requestBody).length === 0 &&
        requestBody.constructor === Object &&
        geminiResponse.messages.length > 0
      ) {
        console.warn(
          "[streamGeminiResponse] Request body is empty but messages exist, aborting SSE connection attempt."
        );
        setLoading(false);
        return;
      }

      console.log(
        "[streamGeminiResponse] Connecting to SSE with body:",
        requestBody
      );
      const es = await getEventSource({
        body: requestBody,
        type: endpointType,
        token: token
      });

      const listener = (event: any) => {
        if (event.type === "open") {
          console.log("[SSE] Open connection.");
        } else if (event.type === "message") {
          if (event.data === "[DONE]") {
            console.log("[SSE] DONE received.");
            setLoading(false);
            setPreferenceStage((prevStage) => {
              console.log(`[SSE DONE] Current stage: ${prevStage}`);
              if (prevStage === "generating") {
                console.log(
                  "[SSE DONE] Switching stage from generating to chatting."
                );
                return "chatting";
              }
              return prevStage;
            });

            currentAssistantMessageId = null;
            es.close();
            setTimeout(scrollToEnd, 50);
            return;
          }

          let parsedData;
          try {
            parsedData = JSON.parse(event.data);
          } catch (parseError) {
            console.error(
              "Error parsing SSE data:",
              parseError,
              "Raw Data:",
              event.data
            );
            parsedData = event.data;
          }

          if (typeof parsedData === "object" && parsedData !== null) {
            if (
              parsedData.action === "ask_preference" &&
              parsedData.question &&
              parsedData.questionId
            ) {
              console.log(`[SSE] Received question: ${parsedData.questionId}`);

              const isFirstQuestion = parsedData.questionId === "userName";
              const alreadyHasFirstQuestion =
                geminiResponse.messages.length > 0 &&
                geminiResponse.messages[0].assistant &&
                geminiResponse.messages[0].assistant.includes(
                  "First, what's your name?"
                );

              const shouldSkip = isFirstQuestion && alreadyHasFirstQuestion;

              if (!shouldSkip) {
                console.log(
                  `[SSE] Adding preference question: ${parsedData.questionId}`
                );
                setGeminiResponse((prevState) => ({
                  ...prevState,
                  messages: [
                    ...prevState.messages,
                    { assistant: parsedData.question, _id: uuid() },
                  ],
                }));
              } else {
                console.log(`[SSE] Skipping duplicate first question`);
              }

              setCurrentQuestionId(parsedData.questionId);
              setPreferenceStage(parsedData.questionId as PreferenceStage);
              setLoading(false);
              es.close();
              setTimeout(scrollToEnd, 50);
            } else if (parsedData.action === "generating_flirt") {
              console.log("[SSE] Received generating_flirt action.");

              setPreferenceStage("generating");
            } else if (parsedData.error) {
              console.error("[SSE] Received error object:", parsedData.error);
              const errorText = `⚠️ Server Error: ${parsedData.error}`;
              setGeminiResponse((prevState) => {
                const messagesCopy = JSON.parse(
                  JSON.stringify(prevState.messages)
                );
                if (
                  messagesCopy.length > 0 &&
                  messagesCopy[messagesCopy.length - 1]?.assistant !== undefined
                ) {
                  messagesCopy[
                    messagesCopy.length - 1
                  ].assistant += `\n${errorText}`;
                } else {
                  messagesCopy.push({ assistant: errorText });
                }
                return { ...prevState, messages: messagesCopy };
              });
              setLoading(false);
              setPreferenceStage("error");
              es.close();
            } else if (parsedData.final_update === true) {
              console.log(
                "[SSE] Received final_update instruction:",
                parsedData
              );
              const finalText = parsedData.text || "";

              console.log(
                "[SSE Final Update] Final text:",
                finalText.substring(0, 100) + "..."
              );

              localResponseAccumulator = finalText;

              if (!localResponseAccumulator.trim()) {
                console.warn(
                  "[SSE Final Update] Received empty text content, setting placeholder"
                );
                localResponseAccumulator =
                  "I'm here! What would you like to talk about?";
              }

              if (isFirstGeneration && finalText.length > 0) {
                console.log(
                  "[SSE Final] Checking for AI name in complete message"
                );

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
                  /Hey.*?[,!]?\s+(?:I'?m|I am|This is|It'?s)\s+(.*?)(?:,|\.|\!|\s+and|\n)/i,
                ];

                let foundName = false;
                for (const pattern of namePatterns) {
                  const match = finalText.match(pattern);
                  if (match && match[1]) {
                    let aiName = match[1].trim();

                    const nonNamePhrases = [
                      "here",
                      "your",
                      "the",
                      "a",
                      "an",
                      "this",
                      "that",
                      "just",
                      "so",
                      "going to",
                      "happy",
                      "excited",
                      "glad",
                      "pleased",
                    ];
                    if (
                      nonNamePhrases.some((phrase) =>
                        aiName.toLowerCase().startsWith(phrase)
                      )
                    ) {
                      continue;
                    }

                    if (aiName.length > 15) {
                      aiName = aiName.split(/\s+/)[0];
                    }

                    if (aiName && aiName.length > 1) {
                      console.log(
                        "[SSE Final] Extracted AI name from intro:",
                        aiName
                      );
                      setAiProfile((prev) => ({
                        ...prev,
                        name: aiName,
                      }));
                      foundName = true;
                      break;
                    }
                  }
                }

                if (!foundName) {
                  const words = finalText.split(/\s+/);
                  for (const word of words) {
                    if (
                      word.length >= 3 &&
                      /^[A-Z][a-z]+$/.test(word) &&
                      ![
                        "I",
                        "My",
                        "Hi",
                        "Hello",
                        "Hey",
                        "The",
                        "This",
                        "That",
                      ].includes(word)
                    ) {
                      console.log(
                        "[SSE Final] Extracted capitalized name from intro:",
                        word
                      );
                      setAiProfile((prev) => ({
                        ...prev,
                        name: word,
                      }));
                      break;
                    }
                  }
                }

                setIsFirstGeneration(false);
              }

              const containsEmptyBackticks = /(?:``|```)\s*(?:``|```)/g.test(
                finalText
              );
              const mentionsImage =
                /\b(?:picture|image|photo|look|see|here)\b/i.test(finalText);

              const likelyImageAttempt =
                (containsEmptyBackticks && mentionsImage) ||
                requestBody.is_potential_image_request === true;

              if (likelyImageAttempt) {
                console.log(
                  "[SSE Final Update] Response contains empty backticks, likely intended for image"
                );

                const imageHint =
                  "\n\n(If you were expecting an image, please try asking with the phrase 'show me a picture' or 'generate an image')";
                console.log("[SSE Final Update] Adding image hint");

                if (!requestBody.is_potential_image_request) {
                  localResponseAccumulator = finalText + imageHint;
                } else {
                  localResponseAccumulator = finalText;
                }
              } else {
                localResponseAccumulator = finalText;
              }

              const containsImageTag =
                /\[\s*generate_image\s*:\s*([^\]]+)\]/i.test(finalText);
              console.log(
                "[SSE Final Update] Contains image tag:",
                containsImageTag
              );

              setGeminiResponse((prevState) => {
                const messagesCopy = JSON.parse(
                  JSON.stringify(prevState.messages)
                );

                const isRegularChatMessage =
                  prevState.messages.length > 0 &&
                  prevState.messages[prevState.messages.length - 1].user !==
                    undefined;

                console.log(
                  "[SSE Final Update] Is regular chat message:",
                  isRegularChatMessage
                );

                const isFirstIntro = prevState.messages.length === 0;
                console.log("[SSE Final Update] Is first intro:", isFirstIntro);

                if (isRegularChatMessage) {
                  if (
                    localResponseAccumulator &&
                    localResponseAccumulator.trim().length > 0
                  ) {
                    const newAssistantMessage = {
                      assistant: localResponseAccumulator,
                      _id: uuid(),
                    };
                    messagesCopy.push(newAssistantMessage);
                  } else {
                    console.warn(
                      "[SSE Final Update] Skipped adding empty message"
                    );
                  }
                } else if (messagesCopy.length > 0) {
                  const lastMessageIndex = messagesCopy.length - 1;

                  if (messagesCopy[lastMessageIndex].assistant !== undefined) {
                    messagesCopy[lastMessageIndex] = {
                      ...messagesCopy[lastMessageIndex],
                      assistant: localResponseAccumulator,
                      image: messagesCopy[lastMessageIndex].image,
                    };
                    console.log(
                      "[SSE Final Update] Updated last assistant message TEXT"
                    );
                  } else {
                    messagesCopy.push({
                      assistant: localResponseAccumulator,
                      _id: uuid(),
                    });
                    console.log(
                      "[SSE Final Update] Last message not from assistant, added new one"
                    );
                  }
                } else if (isFirstIntro) {
                  if (
                    localResponseAccumulator &&
                    localResponseAccumulator.trim().length > 0
                  ) {
                    messagesCopy.push({
                      assistant: localResponseAccumulator,
                      _id: uuid(),
                    });
                  } else {
                    messagesCopy.push({
                      assistant:
                        "Hello! I'm here to chat with you. What would you like to talk about?",
                      _id: uuid(),
                    });
                  }
                } else {
                  console.warn(
                    "[SSE Final Update] Messages array was empty, adding new text message."
                  );
                  messagesCopy.push({
                    assistant: localResponseAccumulator,
                    _id: uuid(),
                  });
                }

                console.log(
                  "[SSE Final Update] Messages count after update:",
                  messagesCopy.length
                );
                console.log(
                  "[SSE Final Update] Message content:",
                  localResponseAccumulator.substring(0, 50)
                );

                const freshMessages = [...messagesCopy];

                return {
                  ...prevState,
                  messages: freshMessages,
                  index: prevState.index,
                };
              });

              setListUpdateToken((t) => t + 1);

              setTimeout(scrollToEnd, 50);
            } else if (
              parsedData.new_image_message === true &&
              parsedData.image
            ) {
              console.log(
                "[SSE] Received new_image_message instruction:",
                parsedData
              );
              const imageUrl = parsedData.image;
              const newImageMsg = { image: imageUrl, _id: uuid() };

              const isFirstImage = !geminiResponse.messages.some(
                (msg) => msg.image
              );
              if (isFirstImage) {
                console.log(
                  "[SSE] Setting first image as AI profile picture:",
                  imageUrl
                );
                setAiProfile((prev) => ({
                  ...prev,
                  avatar: imageUrl,
                }));
              }

              setGeminiResponse((prevState) => ({
                ...prevState,
                messages: [...prevState.messages, newImageMsg],
              }));

              console.log(
                "[SSE New Image] Added new image message:",
                newImageMsg
              );

              setListUpdateToken((t) => t + 1);
            } else {
              console.warn(
                "[SSE] Received unexpected object structure:",
                parsedData
              );
            }
          } else if (typeof parsedData === "string") {
            console.log("[SSE Text] Text chunk received.");

            localResponseAccumulator += parsedData;

            if (isFirstGeneration && localResponseAccumulator.length > 30) {
              console.log("[SSE] Checking for AI name in complete message");

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
                /Hey.*?[,!]?\s+(?:I'?m|I am|This is|It'?s)\s+(.*?)(?:,|\.|\!|\s+and|\n)/i,
              ];

              let foundName = false;
              for (const pattern of namePatterns) {
                const match = localResponseAccumulator.match(pattern);
                if (match && match[1]) {
                  let aiName = match[1].trim();

                  const nonNamePhrases = [
                    "here",
                    "your",
                    "the",
                    "a",
                    "an",
                    "this",
                    "that",
                    "just",
                    "so",
                    "going to",
                    "happy",
                    "excited",
                    "glad",
                    "pleased",
                  ];
                  if (
                    nonNamePhrases.some((phrase) =>
                      aiName.toLowerCase().startsWith(phrase)
                    )
                  ) {
                    continue;
                  }

                  if (aiName.length > 15) {
                    aiName = aiName.split(/\s+/)[0];
                  }

                  if (aiName && aiName.length > 1) {
                    console.log(
                      "[SSE] Extracted AI name from intro:",
                      aiName
                    );
                    setAiProfile((prev) => ({
                      ...prev,
                      name: aiName,
                    }));
                    foundName = true;
                    break;
                  }
                }
              }

              if (!foundName) {
                const words = localResponseAccumulator.split(/\s+/);
                for (const word of words) {
                  if (
                    word.length >= 3 &&
                    /^[A-Z][a-z]+$/.test(word) &&
                    ![
                      "I",
                      "My",
                      "Hi",
                      "Hello",
                      "Hey",
                      "The",
                      "This",
                      "That",
                    ].includes(word)
                  ) {
                    console.log(
                      "[SSE] Extracted capitalized name from intro:",
                      word
                    );
                    setAiProfile((prev) => ({
                      ...prev,
                      name: word,
                    }));
                    break;
                  }
                }
              }

              setIsFirstGeneration(false);
            }

            if (localResponseAccumulator.length < 850) {
              setTimeout(scrollToEnd, 50);
            }

            const isUserMessageResponse =
              geminiResponse.messages.length > 0 &&
              geminiResponse.messages[geminiResponse.messages.length - 1]
                .user !== undefined;

            setGeminiResponse((prevState) => {
              const messagesCopy = JSON.parse(
                JSON.stringify(prevState.messages)
              );

              if (isUserMessageResponse) {
                if (
                  messagesCopy.length > 0 &&
                  messagesCopy[messagesCopy.length - 1].assistant === ""
                ) {
                  messagesCopy[messagesCopy.length - 1].assistant =
                    localResponseAccumulator;
                } else {
                  messagesCopy.push({
                    assistant: localResponseAccumulator,
                    _id: uuid(),
                  });
                }
              } else if (messagesCopy.length > 0) {
                const lastMessageIndex = messagesCopy.length - 1;
                messagesCopy[lastMessageIndex] = {
                  ...messagesCopy[lastMessageIndex],
                  assistant: localResponseAccumulator,
                };
              } else {
                console.warn(
                  "[SSE Text] Messages array was empty, adding new message with text."
                );
                messagesCopy.push({ assistant: localResponseAccumulator });
              }
              return { ...prevState, messages: messagesCopy };
            });
          } else {
            console.warn(
              "[SSE] Received unexpected data type:",
              typeof parsedData,
              event.data
            );
          }
        } else if (event.type === "error") {
          console.error("SSE Connection error:", event.message || event);
          const errorText = `⚠️ Connection Error. Please check your network or restart the chat.`;
          setGeminiResponse((prevState) => {
            const messagesCopy = JSON.parse(
              JSON.stringify(prevState.messages)
            );
            if (
              messagesCopy.length > 0 &&
              messagesCopy[messagesCopy.length - 1]?.assistant !== undefined
            ) {
              messagesCopy[messagesCopy.length - 1].assistant =
                (messagesCopy[messagesCopy.length - 1].assistant || "") +
                `\n${errorText}`;
            } else {
              messagesCopy.push({ assistant: errorText });
            }
            return { ...prevState, messages: messagesCopy };
          });
          setLoading(false);
          setPreferenceStage("error");
          es.close();
        }
      };

      es.addEventListener("open", listener);
      es.addEventListener("message", listener);
      es.addEventListener("error", listener);
    } catch (error) {
      console.error("Failed to get event source:", error);
      const errorMsg = "⚠️ Failed to connect to the chat service.";
      setGeminiResponse((prevState) => {
        const messagesCopy = JSON.parse(
          JSON.stringify(prevState.messages)
        );
        if (
          messagesCopy.length > 0 &&
          messagesCopy[messagesCopy.length - 1]?.assistant !== undefined
        ) {
          messagesCopy[messagesCopy.length - 1].assistant =
            (messagesCopy[messagesCopy.length - 1].assistant || "") +
            `\n${errorMsg}`;
        } else {
          messagesCopy.push({ assistant: errorMsg });
        }
        return { ...prevState, messages: messagesCopy };
      });
      setLoading(false);
      setPreferenceStage("error");
    }
  }

  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text);
  }

  const handleImageTap = (imageUrl: string) => {
    // Ensure the image URL is complete before displaying in modal
    setSelectedImage(ensureCompleteImageUrl(imageUrl));
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
      const FileSystem = require("expo-file-system");
      // Ensure we have a complete URL before downloading
      const completeUrl = ensureCompleteImageUrl(url);
      const fileUri = FileSystem.documentDirectory + uuid() + ".jpg";
      console.log(`Downloading image from ${completeUrl} to: ${fileUri}`);
      const { uri } = await FileSystem.downloadAsync(completeUrl, fileUri);
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
    setPreferenceStage("idle");
  }

  async function handleGenerateImage() {
    if (!input.trim() || loading) return;
    Keyboard.dismiss();

    const currentInput = input;
    setInput("");

    const newUserMessage = { 
      user: currentInput,
      _id: uuid() 
    };
    
    const optimisticMessages = [
      ...geminiResponse.messages,
      newUserMessage
    ];
    
    setGeminiResponse((c) => ({ 
      index: c.index,
      messages: JSON.parse(JSON.stringify(optimisticMessages)),
    }));
    
    setTimeout(scrollToEnd, 50);
    
    setLoading(true);
    
    const enhancedInput = `${currentInput} \`\`[generate_image: ${currentInput}]\`\``;
    const requestBody = {
      prompt: enhancedInput,
      messages: geminiResponse.messages,
      is_potential_image_request: true,
    };
    
    await streamGeminiResponse(requestBody, 'gemini', "");
  }

  // Function to ensure all image URLs in messages are complete
  const processImageURLsInMessages = (messages: Message[]): Message[] => {
    return messages.map(msg => {
      if (msg.image) {
        return {
          ...msg,
          image: ensureCompleteImageUrl(msg.image)
        };
      }
      return msg;
    });
  };

  // Update the renderMessage function to use complete image URLs
  const renderMessage = ({ item }: { item: Message }) => {
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
    
    else if (item.assistant !== undefined || item.image) { 
      const hasText = item.assistant && item.assistant.trim().length > 0;
      const hasImage = !!item.image;
      // Get complete image URL if needed
      const imageUrl = item.image ? ensureCompleteImageUrl(item.image) : undefined;

      if (!hasText && !hasImage && preferenceStage !== 'generating') { 
          console.warn(`[renderMessage] Item has no content to display and not in generating stage`);
          return null;
      }

      if (!hasText && hasImage) {
        console.log(`[renderMessage] Rendering image-only message. Image URL:`, imageUrl);
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
            <Pressable onPress={() => handleImageTap(imageUrl || '')}>
              <Image
                source={{ uri: imageUrl }}
                style={defaultImageStyle}
                resizeMode="cover"
                onError={(e) => logImageError(e, imageUrl || 'unknown')}
                testID="image-message"
              />
            </Pressable>
          </View>
        );
      }
      
      console.log(`[renderMessage] Rendering text message ${hasImage ? ' with image' : ''}`);
      return (
        <Pressable
          onLongPress={() => showClipboardActionsheet(item.assistant || '', imageUrl)}
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
              <Pressable onPress={() => handleImageTap(imageUrl || '')}>
                <Image
                  source={{ uri: imageUrl }}
                  style={{
                    width: width * 0.5,
                    height: width * 0.5,
                    borderRadius: 10,
                    marginTop: hasText ? 10 : 0,
                    alignSelf: 'center'
                  }}
                  resizeMode="cover"
                  onError={(e) => logImageError(e, imageUrl || 'unknown')}
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
    
    return null;
  };

  const renderLoadingIndicator = () => {
    if (!loading) return null;

    return (
      <View style={sheet.loadingContainer}>
        <ActivityIndicator size="small" color={theme.tintColor} />
      </View>
    );
  };

  // Handle sending messages from FlirtChat component
  const handleSendFromFlirtChat = (message: string) => {
    setInput(message);
    handleSendMessage();
  };

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

  const renderFlirtChat = useMemo(() => {
    const showFlirtChat = !loading && !currentQuestionId && geminiResponse.messages.length > 0;
    console.log("[renderFlirtChat] showFlirtChat:", showFlirtChat, "loading:", loading, "currentQuestionId:", currentQuestionId, "messages.length:", geminiResponse.messages.length);

    if (!showFlirtChat) {
      return null;
    }

    // Find the last assistant message
    const lastAssistantMessage = geminiResponse.messages
      .slice()
      .reverse()
      .find(msg => msg.assistant !== undefined);

    // Get the index of the last assistant message
    const lastAssistantMessageIndex = lastAssistantMessage
      ? geminiResponse.messages.lastIndexOf(lastAssistantMessage)
      : -1;

    // Pass only the messages up to and including the last assistant message to FlirtChat
    const messagesForFlirtChat = lastAssistantMessageIndex !== -1
      ? geminiResponse.messages.slice(0, lastAssistantMessageIndex + 1)
      : [];

    console.log("[renderFlirtChat] Messages passed to FlirtChat count:", messagesForFlirtChat.length);

    // Map relevant message properties for FlirtChat
    const mappedMessages = messagesForFlirtChat.map(msg => ({
      id: msg._id || uuid(),
      sender: (msg.user !== undefined ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.user || msg.assistant || '',
      image: msg.image,
      timestamp: '',
    }));

    console.log("[renderFlirtChat] Mapped messages for FlirtChat count:", mappedMessages.length);

    return (
      <FlirtChat
        messages={mappedMessages}
        aiProfile={aiProfile}
        onSendMessage={handleSendFromFlirtChat}
        isGenerating={loading}
        isFirstMessage={geminiResponse.messages.length === 0}
      />
    );
  }, [loading, currentQuestionId, geminiResponse.messages, aiProfile, handleSendFromFlirtChat]);

  return (
    <View style={sheet.container}>
      <KeyboardAvoidingView
        style={sheet.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {!renderFlirtChat && (
          <ScrollView
            ref={scrollViewRef}
            style={sheet.scrollContainer}
            contentContainerStyle={{ paddingVertical: 10 }}
            keyboardShouldPersistTaps="handled"
          >
            {geminiResponse.messages.length === 0 && !loading ? (
              <View style={sheet.greetingContainer}>
                <Text style={sheet.greeting}>
                  Welcome to Chat! Send a message to get started.
                </Text>
              </View>
            ) : (
              geminiResponse.messages.map((message, index) => (
                <View key={message._id || `message-${index}`}>
                  {renderMessage({ item: message })}
                </View>
              ))
            )}
            
            {renderLoadingIndicator()}
          </ScrollView>
        )}

        {!renderFlirtChat && (
          <View style={sheet.chatInputContainer}>
            <TextInput
              style={sheet.input}
              value={input}
              onChangeText={setInput}
              placeholder="Send a message..."
              placeholderTextColor={theme.borderColor}
              editable={!loading}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSendMessage}
              style={({ pressed }) => [
                sheet.buttonStyle,
                loading && sheet.buttonDisabled,
                pressed && sheet.buttonPressed,
              ]}
              disabled={loading || !input.trim()}
            >
              <Ionicons
                name="send"
                size={24}
                color={loading || !input.trim() ? "#888888" : theme.tintTextColor}
              />
            </Pressable>
          </View>
        )}

        {/* Render FlirtChat component if needed */}
        {renderFlirtChat}

        {/* Full Screen Image Modal */}
        <Modal
          visible={modalVisible}
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.8)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{ width: "90%", height: "80%", resizeMode: "contain" }}
              />
            )}
            <Button title="Close" onPress={() => setModalVisible(false)} />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}