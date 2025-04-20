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

export function Chat() {
  const [loading, setLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const { showActionSheetWithOptions } = useActionSheet();

  const [geminiAPIMessages, setGeminiAPIMessages] = useState("");
  const [geminiResponse, setGeminiResponse] = useState({
    messages: [] as Array<{ user: string; assistant?: string }>,
    index: uuid(),
  });

  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);

  async function chat() {
    if (!input || loading) return;
    Keyboard.dismiss();
    generateGeminiResponse();
  }

  async function generateGeminiResponse() {
    if (!input) return;
    Keyboard.dismiss();
    let localResponse = "";

    let geminiArray = [
      ...geminiResponse.messages,
      {
        user: input,
      },
    ] as [{ user: string; assistant?: string }];

    setGeminiResponse((c) => ({
      index: c.index,
      messages: JSON.parse(JSON.stringify(geminiArray)),
    }));

    setLoading(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 1);
    const currentInput = input;
    setInput("");

    const eventSourceArgs = {
      body: {
        prompt: currentInput,
        model: 'gemini',
      },
      type: 'gemini',
    };

    const es = await getEventSource(eventSourceArgs);

    const listener = (event) => {
      if (event.type === "open") {
        console.log("Open SSE connection.");
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
          setLoading(false);
          setGeminiAPIMessages(
            `${geminiAPIMessages}\n\nPrompt: ${currentInput}\n\nResponse:${localResponse}`
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
    setGeminiResponse({ messages: [], index: uuid() });
    setGeminiAPIMessages("");
    setInput("");
  }

  function renderItem({ item }: { item: any }) {
    return (
      <View>
        {item.user && (
          <View style={styles.userMessageContainer}>
            <Pressable
              onLongPress={() => showClipboardActionsheet(item.user)}
              style={({ pressed }) => [
                styles.userMessage,
              ]}
            >
              <Text style={styles.messageText}>{item.user}</Text>
            </Pressable>
          </View>
        )}
        {item.assistant && (
          <View style={styles.responseContainer}>
            <Markdown style={styles.markdownStyle}>
              {item.assistant}
            </Markdown>
          </View>
        )}
      </View>
    );
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
    greetingContainer: {
      justifyContent: "center",
      alignItems: "center",
      flexGrow: 1,
      paddingBottom: 90,
    },
    greeting: {
      fontSize: 24,
      fontFamily: theme.boldFont,
      color: theme.textColor,
      opacity: 0.8,
    },
    loadingContainer: {
      marginVertical: 25,
      justifyContent: "center",
      flexDirection: "row",
      alignItems: "center",
    },
    responseContainer: {
      padding: 15,
      backgroundColor: theme.responseBackgroundColor,
      marginRight: 50,
      borderBottomLeftRadius: 0,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 10,
      marginTop: 10,
      marginBottom: 10,
      marginLeft: 10,
      maxWidth: "85%",
    },
    userMessageContainer: {
      alignItems: "flex-end",
      marginRight: 10,
      marginBottom: 5,
      marginTop: 10,
    },
    userMessage: {
      borderRadius: 8,
      borderTopRightRadius: 0,
      backgroundColor: theme.tintColor,
      paddingVertical: 5,
      paddingHorizontal: 9,
    },
    messageText: {
      color: theme.tintTextColor || theme.white,
      fontFamily: theme.regularFont,
      fontSize: 16,
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
  });

  return { ...styles, markdownStyle };
};
