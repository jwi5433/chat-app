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
} from "react-native";
import "react-native-get-random-values";
import { useContext, useState, useRef } from "react";
import { ThemeContext } from "../context";
import { getEventSource } from "../utils";
import { v4 as uuid } from "uuid";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useActionSheet } from "@expo/react-native-action-sheet";
import Markdown from "@ronradtke/react-native-markdown-display";

type Message = {
  user?: string;
  assistant?: string;
  image?: string;
};

const { width } = Dimensions.get("window");

export function Chat() {
  const [loading, setLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const { showActionSheetWithOptions } = useActionSheet();

  const [geminiAPIMessages, setGeminiAPIMessages] = useState("");
  const [geminiResponse, setGeminiResponse] = useState<{
    messages: Message[];
    index: string;
  }>({
    messages: [],
    index: uuid(),
  });

  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);

  async function chat() {
    if (!input || loading) return;
    Keyboard.dismiss();

    const currentInput = input;
    setInput("");

    await generateGeminiResponse(currentInput);
  }

  async function generateGeminiResponse(currentInput: string) {
    let localResponse = "";
    
    let geminiArray = [
      ...geminiResponse.messages,
      { user: currentInput },
      { assistant: "" }
    ];

    setLoading(true);

    setGeminiResponse((c) => ({
      index: c.index,
      messages: JSON.parse(JSON.stringify(geminiArray)),
    }));
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 1);

    try {
      const es = await getEventSource({
        body: {
          prompt: currentInput,
          messages: geminiResponse.messages,
          model: 'gemini',
        },
        type: 'gemini',
      });

      const listener = (event: any) => {
        if (event.type === "open") {
          console.log("Open SSE connection.");
        } else if (event.type === "message") {
          if (event.data !== "[DONE]") {
            if (localResponse.length < 850) {
              scrollViewRef.current?.scrollToEnd({
                animated: false,
              });
            }
            const rawData = event.data;
            try {
              const parsedData = JSON.parse(rawData);

              if (typeof parsedData === 'object' && parsedData !== null && parsedData.image && typeof parsedData.image === 'string') {
                  geminiArray = [
                      ...geminiArray,
                      { assistant: "", image: parsedData.image }
                  ];
                  setGeminiResponse(c => ({
                      index: c.index,
                      messages: JSON.parse(JSON.stringify(geminiArray))
                  }));
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 50);

              } else if (typeof parsedData === 'string') {
                localResponse = localResponse + parsedData;
                if (geminiArray.length > 0) {
                    geminiArray[geminiArray.length - 1].assistant = localResponse;
                }
                setGeminiResponse((c) => ({
                  index: c.index,
                  messages: JSON.parse(JSON.stringify(geminiArray)),
                }));
              } else {
                 console.warn("Received unexpected SSE data format:", parsedData);
              }

            } catch (parseError) {
              console.error("Error parsing SSE data:", parseError, "Data:", rawData);
              if (geminiArray.length > 0) {
                 geminiArray[geminiArray.length - 1].assistant = (geminiArray[geminiArray.length - 1].assistant || "") + "⚠️ Error processing response stream.";
              }
              setGeminiResponse((c) => ({
                index: c.index,
                messages: JSON.parse(JSON.stringify(geminiArray)),
              }));
              setLoading(false);
              es.close();
            }
          } else {
            setLoading(false);
            es.close();
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 50);
          }
        } else if (event.type === "error") {
          console.error("Connection error:", event.message);
          if (geminiArray.length > 0) {
            geminiArray[geminiArray.length - 1].assistant = (geminiArray[geminiArray.length - 1].assistant || "") + `⚠️ Connection error: ${event.message}`;
          }
          setGeminiResponse((c) => ({
            index: c.index,
            messages: JSON.parse(JSON.stringify(geminiArray)),
          }));
          setLoading(false);
          es.close();
        } else if (event.type === "exception") {
          console.error("Error:", event.message, event.error);
          if (geminiArray.length > 0) {
            geminiArray[geminiArray.length - 1].assistant = (geminiArray[geminiArray.length - 1].assistant || "") + `⚠️ Server exception: ${event.message}`;
          }
          setGeminiResponse((c) => ({
            index: c.index,
            messages: JSON.parse(JSON.stringify(geminiArray)),
          }));
          setLoading(false);
          es.close();
        }
      };

      es.addEventListener("open", listener);
      es.addEventListener("message", listener);
      es.addEventListener("error", listener);
    } catch (error) {
      console.error("Failed to get event source:", error);
      geminiArray[geminiArray.length - 1].assistant = "⚠️ Failed to connect to the chat service.";
      setGeminiResponse((c) => ({
        index: c.index,
        messages: JSON.parse(JSON.stringify(geminiArray)),
      }));
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text);
  }

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
          console.log("Saving image...");
          await downloadImageToDevice(image!);
        } else if (selectedOption === "Clear Chat") {
          clearChat();
        }
      }
    );
  }

  async function downloadImageToDevice(url: string) {
    try {
      const FileSystem = require('expo-file-system');
      const fileUri = FileSystem.documentDirectory + uuid() + ".png";
      console.log(`Downloading to: ${fileUri}`);
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      console.log("Finished downloading to ", uri);
      alert("Image saved to app files.");
    } catch (e) {
      console.error("Error downloading image:", e);
      alert("Failed to download image.");
    }
  }

  async function clearChat() {
    if (loading) return;
    setGeminiResponse({ messages: [], index: uuid() });
    setGeminiAPIMessages("");
    setInput("");
  }

  function renderItem({ item }: { item: Message }) {
    if (item.user) {
      return (
        <View style={styles.userMessageOuterWrapper}>
          <View style={styles.userMessageContainer}>
            <View style={styles.userMessageWrapper}>
              <Text style={styles.userMessageText}>
                {item.user}
              </Text>
            </View>
          </View>
        </View>
      );
    }
    
    else if (item.assistant || item.image) {
      return (
        <Pressable
          onLongPress={() => showClipboardActionsheet(item.assistant || '', item.image)}
          style={styles.responseContainerPressable}
        >
          <View style={styles.responseContainer}>
            {item.assistant?.trim() && (
              <Markdown style={styles.markdownStyle}>
                {item.assistant}
              </Markdown>
            )}
            {item.image && (
              <Image
                source={{ uri: item.image }}
                style={styles.imageStyle}
                resizeMode="contain"
              />
            )}
          </View>
        </Pressable>
      );
    }

    return null;
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.container}
        keyboardVerticalOffset={110}>
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          style={styles.scrollContainer}>
          {geminiResponse.messages.length === 0 && (
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>Send a message to start chatting!</Text>
            </View>
          )}
          <FlatList
            data={geminiResponse.messages}
            renderItem={renderItem}
            scrollEnabled={false}
            keyExtractor={(item, index) => `${geminiResponse.index}-${index}`}
          />
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.tintColor} />
            </View>
          )}
        </ScrollView>
        <View style={styles.chatInputContainer}>
          <TextInput
            onChangeText={setInput}
            style={styles.input}
            placeholder="Send a message..."
            placeholderTextColor={theme.placeholderTextColor}
            autoCorrect={true}
            value={input}
            readOnly={loading}
          />
          <Pressable
            onPress={chat}
            disabled={loading || !input}
            style={({ pressed }) => [
              styles.buttonStyle,
              (loading || !input) && styles.buttonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.tintTextColor} />
            ) : (
              <Ionicons
                name="arrow-up"
                size={20}
                color={theme.tintTextColor}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (theme: any) => {
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
    link: {
      color: theme.tintColor,
      textDecorationLine: "underline" as const,
    },
    list_item: {
      marginBottom: 5,
    },
    bullet_list: {
      marginLeft: 10,
    },
    ordered_list: {
      marginLeft: 10,
    },
    blockquote: {
      backgroundColor: theme.borderColor,
      borderLeftColor: theme.tintColor,
      borderLeftWidth: 4,
      padding: 10,
      marginLeft: 5,
      marginVertical: 5,
    },
    strong: {
      fontFamily: theme.boldFont,
    },
    em: {
      fontStyle: 'italic' as const,
    }
  };

  const styles = StyleSheet.create({
    userMessageOuterWrapper: {
      marginTop: 10,
    },
    greetingContainer: {
      justifyContent: "center",
      alignItems: "center",
      flexGrow: 1,
      paddingBottom: 90,
      paddingHorizontal: 20,
    },
    greeting: {
      fontSize: 20,
      textAlign: 'center',
      fontFamily: theme.regularFont,
      color: theme.textColor,
      opacity: 0.6,
    },
    loadingContainer: {
      marginVertical: 25,
      justifyContent: "center",
      flexDirection: "row",
      alignItems: "center",
    },
    responseContainerPressable: {
      alignSelf: 'flex-start',
      maxWidth: "85%",
      marginLeft: 10,
    },
    responseContainer: {
      padding: 15,
      backgroundColor: theme.responseBackgroundColor,
      borderBottomLeftRadius: 0,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 10,
      marginTop: 10,
      marginBottom: 10,
    },
    userMessageContainer: {
      alignItems: 'flex-end',
      marginRight: 15,
      marginLeft: 24,
    },
    userMessageWrapper: {
      maxWidth: '85%',
      borderRadius: 8,
      borderTopRightRadius: 0,
      backgroundColor: theme.tintColor,
    },
    userMessageText: {
      color: theme.tintTextColor,
      fontFamily: theme.regularFont,
      fontSize: 16,
      paddingVertical: 5,
      paddingHorizontal: 9,
    },
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    scrollContainer: {
      flex: 1,
      paddingTop: 10,
    },
    chatInputContainer: {
      paddingTop: 5,
      borderTopWidth: 1,
      borderColor: theme.borderColor,
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 5,
      paddingHorizontal: 5,
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
      borderColor: theme.borderColor,
      fontFamily: theme.semiBoldFont,
    },
    buttonStyle: {
      marginRight: 5,
      padding: 8,
      borderRadius: 99,
      backgroundColor: theme.tintColor,
      justifyContent: "center",
      alignItems: "center",
      width: 38,
      height: 38,
    },
    buttonDisabled: {
      backgroundColor: theme.disabledColor || "#cccccc",
      opacity: 0.7,
    },
    imageStyle: {
      width: width * 0.7,
      height: width * 0.7,
      marginTop: 10,
      borderRadius: 8,
      backgroundColor: theme.borderColor || "#e0e0e0",
      alignSelf: 'center',
    },
  });

  return { ...styles, markdownStyle };
};
