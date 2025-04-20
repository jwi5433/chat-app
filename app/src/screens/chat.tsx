import {
  View,
  Text,
  KeyboardAvoidingView,
  StyleSheet,
  TouchableHighlight,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Image, // Keep Image import just in case, but not used in this version
} from "react-native";
import "react-native-get-random-values";
import { useContext, useState, useRef } from "react";
import { ThemeContext, AppContext } from "../context";
// Import necessary utils for chat ONLY
import {
  getEventSource,
  getFirstN,
  getFirstNCharsOrLess,
  getChatType,
} from "../utils";
import { v4 as uuid } from "uuid";
import Ionicons from "@expo/vector-icons/Ionicons";
import { IOpenAIMessages, IOpenAIStateWithIndex } from "../../types";
import * as Clipboard from "expo-clipboard";
import { useActionSheet } from "@expo/react-native-action-sheet";
import Markdown from "@ronradtke/react-native-markdown-display";
// Removed: import { callImageGenerationEndpoint } from "../utils";

export function Chat() {
  const [loading, setLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const { showActionSheetWithOptions } = useActionSheet();
  // Removed: const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // --- Keep all the existing state management for different LLMs ---
  // claude state management
  const [claudeAPIMessages, setClaudeAPIMessages] = useState("");
  const [claudeResponse, setClaudeResponse] = useState({
    messages: [] as Array<{ user: string; assistant?: string }>,
    index: uuid(),
  });

  // openAI state management
  const [openaiMessages, setOpenaiMessages] = useState<IOpenAIMessages[]>([]);
  const [openaiResponse, setOpenaiResponse] = useState<IOpenAIStateWithIndex>({
    messages: [],
    index: uuid(),
  });

  // cohere state management
  const [cohereResponse, setCohereResponse] = useState({
    messages: [] as Array<{ user: string; assistant?: string }>,
    index: uuid(),
  });

  // mistral state management
  const [mistralAPIMessages, setMistralAPIMessages] = useState("");
  const [mistralResponse, setMistralResponse] = useState({
    messages: [] as Array<{ user: string; assistant?: string }>,
    index: uuid(),
  });

  // Gemini state management
  const [geminiAPIMessages, setGeminiAPIMessages] = useState("");
  const [geminiResponse, setGeminiResponse] = useState({
    messages: [] as Array<{ user: string; assistant?: string }>,
    index: uuid(),
  });
  // --- End LLM State ---

  const { theme } = useContext(ThemeContext);
  const { chatType } = useContext(AppContext); // chatType determines which LLM is active
  const styles = getStyles(theme);

  // --- Original chat function structure ---
  async function chat() {
    if (!input || loading) return; // Prevent empty/double send
    Keyboard.dismiss();
    // Loading state is handled within each generate function now

    // Call the specific function based on the selected chatType
    if (chatType.label.includes("claude")) {
      generateClaudeResponse(); // Doesn't need input passed if it reads state
    } else if (chatType.label.includes("cohere")) {
      generateCohereResponse(); // Doesn't need input passed
    } else if (chatType.label.includes("mistral")) {
      generateMistralResponse(); // Doesn't need input passed
    } else if (chatType.label.includes("gemini")) {
      generateGeminiResponse(); // Doesn't need input passed
    } else {
      generateOpenaiResponse(); // Doesn't need input passed
    }
  }

  // --- Keep ALL original generate...Response functions EXACTLY as they were ---
  // Make sure they read the 'input' state directly and handle their own
  // setLoading(true) and setLoading(false) calls.
  // (The versions below are from your original file, assuming they were correct)

  async function generateGeminiResponse() {
    if (!input) return; // Check input inside the function
    Keyboard.dismiss();
    let localResponse = "";
    const geminiInput = `${input}`; // Use current input state

    let geminiArray = [
      ...geminiResponse.messages,
      {
        user: input, // Use current input state
      },
    ] as [{ user: string; assistant?: string }];

    setGeminiResponse((c) => ({
      index: c.index,
      messages: JSON.parse(JSON.stringify(geminiArray)),
    }));

    setLoading(true); // Set loading true HERE
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 1);
    const currentInput = input; // Store before clearing
    setInput(""); // Clear state here

    const eventSourceArgs = {
      body: {
        prompt: geminiInput,
        model: chatType.label,
      },
      type: getChatType(chatType),
    };

    const es = await getEventSource(eventSourceArgs);

    const listener = (event) => {
      if (event.type === "open") {
        console.log("Open SSE connection.");
        // Removed setLoading(false) here
      } else if (event.type === "message") {
        if (event.data !== "[DONE]") {
          if (localResponse.length < 850) {
            scrollViewRef.current?.scrollToEnd({
              animated: true,
            });
          }
          const data = event.data;
          localResponse = localResponse + JSON.parse(data);
          geminiArray[geminiArray.length - 1].assistant = localResponse;
          setGeminiResponse((c) => ({
            index: c.index,
            messages: JSON.parse(JSON.stringify(geminiArray)),
          }));
        } else {
          setLoading(false); // Set false when DONE
          setGeminiAPIMessages(
            `${geminiAPIMessages}\n\nPrompt: ${currentInput}\n\nResponse:${localResponse}` // Use stored currentInput
          );
          es.close();
        }
      } else if (event.type === "error") {
        console.error("Connection error:", event.message);
        setLoading(false);
        es.close(); // Close on error
      } else if (event.type === "exception") {
        console.error("Error:", event.message, event.error);
        setLoading(false);
        es.close(); // Close on error
      }
    };

    es.addEventListener("open", listener);
    es.addEventListener("message", listener);
    es.addEventListener("error", listener);
  }

  async function generateMistralResponse() {
    if (!input) return;
    Keyboard.dismiss();
    let localResponse = "";
    const mistralInput = `${mistralAPIMessages}\n\n Prompt: ${input}`;

    let mistralArray = [
      ...mistralResponse.messages,
      {
        user: input,
      },
    ] as [{ user: string; assistant?: string }];

    setMistralResponse((c) => ({
      index: c.index,
      messages: JSON.parse(JSON.stringify(mistralArray)),
    }));

    setLoading(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 1);
    const currentInput = input; // Store before clearing
    setInput(""); // Clear state

    const eventSourceArgs = {
      body: {
        prompt: mistralInput,
        model: chatType.label,
      },
      type: getChatType(chatType),
    };

    const es = await getEventSource(eventSourceArgs);

    const listener = (event) => {
      if (event.type === "open") {
        console.log("Open SSE connection.");
        // setLoading(false);
      } else if (event.type === "message") {
        if (event.data !== "[DONE]") {
          if (localResponse.length < 850) {
            scrollViewRef.current?.scrollToEnd({
              animated: true,
            });
          }
          const data = event.data;
          // Assuming mistral sends { data: "chunk" } or similar
          localResponse = localResponse + (JSON.parse(data).data || "");

          mistralArray[mistralArray.length - 1].assistant = localResponse;
          setMistralResponse((c) => ({
            index: c.index,
            messages: JSON.parse(JSON.stringify(mistralArray)),
          }));
        } else {
          setLoading(false);
          setMistralAPIMessages(
            `${mistralAPIMessages}\n\nPrompt: ${currentInput}\n\nResponse:${getFirstNCharsOrLess(
              localResponse,
              2000
            )}`
          );
          es.close();
        }
      } else if (event.type === "error") {
        console.error("Connection error:", event.message);
        setLoading(false);
        es.close();
      } else if (event.type === "exception") {
        console.error("Error:", event.message, event.error);
        setLoading(false);
        es.close();
      }
    };

    es.addEventListener("open", listener);
    es.addEventListener("message", listener);
    es.addEventListener("error", listener);
  }

  async function generateClaudeResponse() {
    if (!input) return;
    Keyboard.dismiss();
    let localResponse = "";
    const claudeInput = `${claudeAPIMessages}\n\nHuman: ${input}\n\nAssistant:`;

    let claudeArray = [
      ...claudeResponse.messages,
      {
        user: input,
      },
    ] as [{ user: string; assistant?: string }];

    setClaudeResponse((c) => ({
      index: c.index,
      messages: JSON.parse(JSON.stringify(claudeArray)),
    }));

    setLoading(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 1);
    const currentInput = input; // Store before clearing
    setInput(""); // Clear state

    const eventSourceArgs = {
      body: {
        prompt: claudeInput,
        model: chatType.label,
      },
      type: getChatType(chatType),
    };

    const es = await getEventSource(eventSourceArgs);

    const listener = (event) => {
      if (event.type === "open") {
        console.log("Open SSE connection.");
        // setLoading(false);
      } else if (event.type === "message") {
        if (event.data !== "[DONE]") {
          if (localResponse.length < 850) {
            scrollViewRef.current?.scrollToEnd({
              animated: true,
            });
          }
          const data = event.data;
          localResponse = localResponse + JSON.parse(data).text;
          claudeArray[claudeArray.length - 1].assistant = localResponse;
          setClaudeResponse((c) => ({
            index: c.index,
            messages: JSON.parse(JSON.stringify(claudeArray)),
          }));
        } else {
          setLoading(false);
          setClaudeAPIMessages(
            `${claudeAPIMessages}\n\nHuman: ${currentInput}\n\nAssistant:${getFirstNCharsOrLess(
              localResponse,
              2000
            )}`
          );
          es.close();
        }
      } else if (event.type === "error") {
        console.error("Connection error:", event.message);
        setLoading(false);
        es.close();
      } else if (event.type === "exception") {
        console.error("Error:", event.message, event.error);
        setLoading(false);
        es.close();
      }
    };
    es.addEventListener("open", listener);
    es.addEventListener("message", listener);
    es.addEventListener("error", listener);
  }

  async function generateOpenaiResponse() {
    if (!input) return; // Check input inside function
    Keyboard.dismiss();
    try {
      setLoading(true); // Set loading true here
      let messagesRequest = getFirstN({ messages: openaiMessages });
      if (openaiResponse.messages.length) {
        messagesRequest = [
          ...messagesRequest,
          {
            role: "assistant",
            content: getFirstNCharsOrLess(
              openaiResponse.messages[openaiResponse.messages.length - 1]
                .assistant || ""
            ),
          },
        ];
      }
      messagesRequest = [...messagesRequest, { role: "user", content: input }];
      setOpenaiMessages(messagesRequest);

      let openaiArray = [
        ...openaiResponse.messages,
        {
          user: input,
          assistant: "",
        },
      ];
      setOpenaiResponse((c) => ({
        index: c.index,
        messages: JSON.parse(JSON.stringify(openaiArray)),
      }));

      let localResponse = "";
      const eventSourceArgs = {
        body: {
          messages: messagesRequest,
          model: chatType.label,
        },
        type: getChatType(chatType),
      };
      // const currentInput = input; // No need to store if clearing below
      setInput(""); // Clear state here
      const eventSource = getEventSource(eventSourceArgs);

      const listener = (event: any) => {
        if (event.type === "open") {
          console.log("Open SSE connection.");
          // setLoading(false);
        } else if (event.type === "message") {
          if (event.data !== "[DONE]") {
            if (localResponse.length < 850) {
              scrollViewRef.current?.scrollToEnd({
                animated: true,
              });
            }
            const chunk = JSON.parse(event.data).content;
            if (chunk) {
              localResponse = localResponse + chunk;
              openaiArray[openaiArray.length - 1].assistant = localResponse;
              setOpenaiResponse((c) => ({
                index: c.index,
                messages: JSON.parse(JSON.stringify(openaiArray)),
              }));
            }
          } else {
            setLoading(false);
            eventSource.close();
          }
        } else if (event.type === "error") {
          console.error("Connection error:", event.message);
          setLoading(false);
          eventSource.close();
        } else if (event.type === "exception") {
          console.error("Error:", event.message, event.error);
          setLoading(false);
          eventSource.close();
        }
      };
      eventSource.addEventListener("open", listener);
      eventSource.addEventListener("message", listener);
      eventSource.addEventListener("error", listener);
    } catch (err) {
      console.log("error in generateOpenaiResponse: ", err);
      setLoading(false); // Ensure loading false on outer catch
    }
  }

  async function generateCohereResponse() {
    if (!input) return; // Check input inside function
    Keyboard.dismiss();
    try {
      let localResponse = "";
      let requestInput = input;

      let cohereArray = [
        ...cohereResponse.messages,
        {
          user: input,
          assistant: "",
        },
      ];

      setCohereResponse((r) => ({
        index: r.index,
        messages: JSON.parse(JSON.stringify(cohereArray)),
      }));

      setLoading(true); // Set loading true here
      // const currentInput = input; // Store before clearing if needed for API messages
      setInput(""); // Clear state here
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({
          animated: true,
        });
      }, 1);

      const eventSourceArgs = {
        type: getChatType(chatType),
        body: {
          prompt: requestInput,
          conversationId: cohereResponse.index,
          model: chatType.label,
        },
      };

      const es = await getEventSource(eventSourceArgs);

      const listener = (event) => {
        if (event.data === "[DONE]") {
          console.log("Cohere stream done.");
          setLoading(false);
          return es.close();
        }
        if (event.type === "open") {
          console.log("Cohere SSE connection opened.");
          // setLoading(false);
        } else if (event.type === "message") {
          try {
            const parsedData = JSON.parse(event.data);
            if (parsedData.text) {
              let chunk = parsedData.text;
              if (!localResponse && chunk.charAt(0) === " ")
                chunk = chunk.substring(1);
              if (!localResponse && chunk === "\n") return;

              localResponse = localResponse + chunk;
              cohereArray[cohereArray.length - 1].assistant = localResponse;
              setCohereResponse((r) => ({
                index: r.index,
                messages: JSON.parse(JSON.stringify(cohereArray)),
              }));
            }
            if (parsedData.is_finished) {
              console.log("Cohere message indicates finish.");
              setLoading(false);
              es.close();
            }
          } catch (err) {
            console.log("Error parsing Cohere data:", err, event.data);
            // setLoading(false); // Decide handling
            // es.close();
          }
        } else if (event.type === "error" || event.type === "exception") {
          console.error("Cohere connection error:", event.message);
          setLoading(false);
          es.close();
        } else {
          console.log("Cohere - Unknown event type:", event.type, event.data);
          setLoading(false);
          es.close();
        }
      };

      es.addEventListener("open", listener);
      es.addEventListener("message", listener);
      es.addEventListener("error", listener);
    } catch (err) {
      console.log("error generating cohere chat...", err);
      setLoading(false); // Ensure loading false on outer catch
    }
  }

  // --- Keep copyToClipboard, showClipboardActionsheet, clearChat as they were ---
  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text);
  }

  async function showClipboardActionsheet(text: string) {
    const cancelButtonIndex = 2;
    showActionSheetWithOptions(
      {
        options: ["Copy to clipboard", "Clear chat", "cancel"],
        cancelButtonIndex,
      },
      (selectedIndex) => {
        if (selectedIndex === Number(0)) {
          copyToClipboard(text);
        }
        if (selectedIndex === 1) {
          clearChat();
        }
      }
    );
  }

  async function clearChat() {
    if (loading) return;
    // Reset all model states
    setClaudeResponse({ messages: [], index: uuid() });
    setClaudeAPIMessages("");
    setCohereResponse({ messages: [], index: uuid() });
    setMistralResponse({ messages: [], index: uuid() });
    setMistralAPIMessages("");
    setGeminiResponse({ messages: [], index: uuid() });
    setGeminiAPIMessages("");
    setOpenaiResponse({ messages: [], index: uuid() });
    setOpenaiMessages([]);
    // Removed: setGeneratedImageUrl(null);
  }

  // --- Keep renderItem as it was ---
  function renderItem({ item, index }: { item: any; index: number }) {
    return (
      <View style={styles.promptResponse} key={index}>
        <View style={styles.promptTextContainer}>
          <View style={styles.promptTextWrapper}>
            <Text style={styles.promptText}>{item.user}</Text>
          </View>
        </View>
        {item.assistant && (
          <View style={styles.textStyleContainer}>
            <Markdown style={styles.markdownStyle as any}>
              {item.assistant}
            </Markdown>
            <TouchableHighlight
              onPress={() => showClipboardActionsheet(item.assistant)}
              underlayColor={"transparent"}>
              <View style={styles.optionsIconWrapper}>
                <Ionicons name="apps" size={20} color={theme.textColor} />
              </View>
            </TouchableHighlight>
          </View>
        )}
      </View>
    );
  }

  // --- Keep callMade calculation as it was ---
  const callMade = (() => {
    if (chatType.label.includes("claude")) {
      return claudeResponse.messages.length > 0;
    }
    if (chatType.label.includes("cohere")) {
      return cohereResponse.messages.length > 0;
    }
    if (chatType.label.includes("mistral")) {
      return mistralResponse.messages.length > 0;
    }
    if (chatType.label.includes("gemini")) {
      return geminiResponse.messages.length > 0;
    }
    return openaiResponse.messages.length > 0;
  })();

  // --- Keep JSX structure, removing the generatedImageUrl display ---
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.container}
      keyboardVerticalOffset={110}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        contentContainerStyle={!callMade && styles.scrollContentContainer} // Original condition
      >
        {/* Initial Input Area */}
        {!callMade && ( // Original condition
          <View style={styles.midChatInputWrapper}>
            <View style={styles.midChatInputContainer}>
              <TextInput
                onChangeText={(v) => setInput(v)}
                style={styles.midInput}
                placeholder="Message" // Original placeholder
                placeholderTextColor={theme.placeholderTextColor}
                autoCorrect={true}
                value={input} // Keep value prop
              />
              <TouchableHighlight
                onPress={chat}
                underlayColor={"transparent"}
                disabled={loading} // Keep disabled state
              >
                <View
                  style={[
                    styles.midButtonStyle,
                    loading && styles.disabledButton,
                  ]}>
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={22}
                    color={theme.tintTextColor}
                  />
                  <Text style={styles.midButtonText}>
                    Start {chatType.name} Chat
                  </Text>
                </View>
              </TouchableHighlight>
              <Text style={styles.chatDescription}>
                Chat with a variety of different language models.
              </Text>
            </View>
          </View>
        )}

        {/* Chat History Area */}
        {callMade && ( // Original condition
          <>
            {chatType.label.includes("gpt") && (
              <FlatList
                data={openaiResponse.messages}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            )}
            {chatType.label.includes("claude") && (
              <FlatList
                data={claudeResponse.messages}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            )}
            {chatType.label.includes("cohere") && (
              <FlatList
                data={cohereResponse.messages}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            )}
            {chatType.label.includes("mistral") && (
              <FlatList
                data={mistralResponse.messages}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            )}
            {chatType.label.includes("gemini") && (
              <FlatList
                data={geminiResponse.messages}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            )}
          </>
        )}

        {/* Removed the generatedImageUrl display block */}

        {/* Loading Indicator */}
        {loading && <ActivityIndicator style={styles.loadingContainer} />}
      </ScrollView>

      {/* Bottom Input Area */}
      {callMade && ( // Original condition
        <View style={styles.chatInputContainer}>
          <TextInput
            style={styles.input}
            onChangeText={(v) => setInput(v)}
            placeholder="Message" // Original placeholder
            placeholderTextColor={theme.placeholderTextColor}
            value={input}
          />
          <TouchableHighlight
            underlayColor={"transparent"}
            activeOpacity={0.65}
            onPress={chat}
            disabled={loading} // Keep disabled state
          >
            <View style={[styles.chatButton, loading && styles.disabledButton]}>
              <Ionicons
                name="arrow-up-outline"
                size={20}
                color={theme.tintTextColor}
              />
            </View>
          </TouchableHighlight>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// --- Keep original styles, removing the testImage styles ---
const getStyles = (theme: any) =>
  StyleSheet.create({
    disabledButton: {
      // Keep this if you want visual feedback for disabled
      opacity: 0.5,
    },
    optionsIconWrapper: { padding: 10, paddingTop: 9, alignItems: "flex-end" },
    scrollContentContainer: { flex: 1 },
    chatDescription: {
      color: theme.textColor,
      textAlign: "center",
      marginTop: 15,
      fontSize: 13,
      paddingHorizontal: 34,
      opacity: 0.8,
      fontFamily: theme.regularFont,
    },
    midInput: {
      marginBottom: 8,
      borderWidth: 1,
      paddingHorizontal: 25,
      marginHorizontal: 10,
      paddingVertical: 15,
      borderRadius: 99,
      color: theme.textColor,
      borderColor: theme.borderColor,
      fontFamily: theme.mediumFont,
    },
    midButtonStyle: {
      flexDirection: "row",
      marginHorizontal: 14,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: 99,
      backgroundColor: theme.tintColor,
      justifyContent: "center",
      alignItems: "center",
    },
    midButtonText: {
      color: theme.tintTextColor,
      marginLeft: 10,
      fontFamily: theme.boldFont,
      fontSize: 16,
    },
    midChatInputWrapper: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    midChatInputContainer: { width: "100%", paddingTop: 5, paddingBottom: 5 },
    loadingContainer: { marginTop: 25 },
    promptResponse: { marginTop: 10 },
    textStyleContainer: {
      borderWidth: 1,
      marginRight: 25,
      borderColor: theme.borderColor,
      padding: 15,
      paddingBottom: 6,
      paddingTop: 5,
      margin: 10,
      borderRadius: 13,
    },
    promptTextContainer: {
      flex: 1,
      alignItems: "flex-end",
      marginRight: 15,
      marginLeft: 24,
    },
    promptTextWrapper: {
      borderRadius: 8,
      borderTopRightRadius: 0,
      backgroundColor: theme.tintColor,
    },
    promptText: {
      color: theme.tintTextColor,
      fontFamily: theme.regularFont,
      paddingVertical: 5,
      paddingHorizontal: 9,
      fontSize: 16,
    },
    chatButton: {
      marginRight: 14,
      padding: 5,
      borderRadius: 99,
      backgroundColor: theme.tintColor,
    },
    chatInputContainer: {
      paddingTop: 5,
      borderColor: theme.borderColor,
      borderTopWidth: StyleSheet.hairlineWidth,
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 5,
      backgroundColor: theme.backgroundColor,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 99,
      color: theme.textColor,
      marginHorizontal: 10,
      paddingVertical: 10,
      paddingHorizontal: 21,
      /* Removed paddingRight */ borderColor: theme.borderColor,
      fontFamily: theme.semiBoldFont,
    },
    container: { backgroundColor: theme.backgroundColor, flex: 1 },
    markdownStyle: {
      // Keep existing markdown styles
      body: { color: theme.textColor, fontFamily: theme.regularFont },
      paragraph: {
        color: theme.textColor,
        fontSize: 16,
        fontFamily: theme.regularFont,
      },
      heading1: {
        color: theme.textColor,
        fontFamily: theme.semiBoldFont,
        marginVertical: 5,
      },
      heading2: {
        marginTop: 20,
        color: theme.textColor,
        fontFamily: theme.semiBoldFont,
        marginBottom: 5,
      },
      heading3: {
        marginTop: 20,
        color: theme.textColor,
        fontFamily: theme.mediumFont,
        marginBottom: 5,
      },
      heading4: {
        marginTop: 10,
        color: theme.textColor,
        fontFamily: theme.mediumFont,
        marginBottom: 5,
      },
      heading5: {
        marginTop: 10,
        color: theme.textColor,
        fontFamily: theme.mediumFont,
        marginBottom: 5,
      },
      heading6: {
        color: theme.textColor,
        fontFamily: theme.mediumFont,
        marginVertical: 5,
      },
      list_item: {
        marginTop: 7,
        color: theme.textColor,
        fontFamily: theme.regularFont,
        fontSize: 16,
      },
      ordered_list_icon: {
        color: theme.textColor,
        fontSize: 16,
        fontFamily: theme.regularFont,
      },
      bullet_list: { marginTop: 10 },
      ordered_list: { marginTop: 7 },
      bullet_list_icon: {
        color: theme.textColor,
        fontSize: 16,
        fontFamily: theme.regularFont,
      },
      code_inline: {
        color: theme.secondaryTextColor,
        backgroundColor: theme.secondaryBackgroundColor,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, .1)",
        fontFamily: theme.lightFont,
      },
      hr: { backgroundColor: "rgba(255, 255, 255, .1)", height: 1 },
      fence: {
        marginVertical: 5,
        padding: 10,
        color: theme.secondaryTextColor,
        backgroundColor: theme.secondaryBackgroundColor,
        borderColor: "rgba(255, 255, 255, .1)",
        fontFamily: theme.regularFont,
      },
      tr: {
        borderBottomWidth: 1,
        borderColor: "rgba(255, 255, 255, .2)",
        flexDirection: "row",
      },
      table: {
        marginTop: 7,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, .2)",
        borderRadius: 3,
      },
      blockquote: {
        backgroundColor: "#312e2e",
        borderColor: "#CCC",
        borderLeftWidth: 4,
        marginLeft: 5,
        paddingHorizontal: 5,
        marginVertical: 5,
      },
    } as any,
  });
