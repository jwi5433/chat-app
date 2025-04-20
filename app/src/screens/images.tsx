import React, { useState, useRef, useContext } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Keyboard,
  Image,
} from "react-native";
import {
  DOMAIN,
  IMAGE_MODELS,
} from "../../constants";
import { v4 as uuid } from "uuid";
import { ThemeContext } from "../context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useActionSheet } from "@expo/react-native-action-sheet";
import * as FileSystem from "expo-file-system";
import * as Clipboard from "expo-clipboard";

interface ImageLogItem {
  id: string;
  user?: string;
  image?: string;
  model?: string;
}

const { width } = Dimensions.get("window");

type ImagesState = {
  index: () => string;
  values: ImageLogItem[];
};

const MODEL_LABEL = IMAGE_MODELS.fluxPro.label;
const MODEL_NAME = IMAGE_MODELS.fluxPro.name;

export function Images() {
  const [callMade, setCallMade] = useState(false);
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  const [input, setInput] = useState("");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImagesState>({
    index: uuid,
    values: [],
  });

  const { showActionSheetWithOptions } = useActionSheet();

  async function generate() {
    if (loading || !input) return;

    Keyboard.dismiss();
    const currentInput = input;
    const newItemId = uuid();

    try {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 1);
      setCallMade(true);

      const newItem: ImageLogItem = {
        id: newItemId,
        user: currentInput,
      };
      setImages((prevImages) => ({
        index: prevImages.index,
        values: [...prevImages.values, newItem],
      }));

      const body: Record<string, any> = {
        model: MODEL_LABEL,
        prompt: currentInput,
      };

      setLoading(true);
      setInput("");

      interface ApiResponse {
        image?: string;
        error?: string;
      }

      const response: ApiResponse = await fetch(`${DOMAIN}/images/fal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }).then((res) => res.json() as Promise<ApiResponse>);

      if (response.image) {
        setImages((prevImages) => {
          const updatedValues = prevImages.values.map((item) => {
            if (item.id === newItemId) {
              return {
                ...item,
                image: response.image,
                model: MODEL_NAME,
              };
            }
            return item;
          });
          return { index: prevImages.index, values: updatedValues };
        });

        setLoading(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 50);
      } else {
        setLoading(false);
        console.error("Error generating image (API Response):", response);
        setImages((prevImages) => ({
          index: prevImages.index,
          values: prevImages.values.filter((item) => item.id !== newItemId),
        }));
        alert(`Error: ${response.error || "Unknown API error"}`);
      }
    } catch (err: any) {
      setLoading(false);
      console.error("Error generating image (Catch block):", err);
      setImages((prevImages) => ({
        index: prevImages.index,
        values: prevImages.values.filter((item) => item.id !== newItemId),
      }));
      alert(
        `An unexpected error occurred: ${err.message || "Please try again."}`
      );
    }
  }

  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text);
  }

  function clearPrompts() {
    setCallMade(false);
    setImages({
      index: uuid,
      values: [],
    });
    setInput("");
  }

  async function showClipboardActionsheet(d: ImageLogItem) {
    const options = ["Save image", "Clear prompts", "Cancel"];
    const cancelButtonIndex = 2;
    const destructiveButtonIndex = 1;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
      },
      (selectedIndex?: number) => {
        if (selectedIndex === 0 && d.image) {
          console.log("saving image ...");
          downloadImageToDevice(d.image);
        }
        if (selectedIndex === 1) {
          clearPrompts();
        }
      }
    );
  }

  async function downloadImageToDevice(url: string) {
    try {
      const fileUri = FileSystem.documentDirectory + uuid() + ".png";
      console.log(`Downloading to: ${fileUri}`);
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      console.log("Finished downloading to ", uri);
      alert("Image downloaded. Check app files.");
    } catch (e) {
      console.error("Error downloading image:", e);
      alert("Failed to download image.");
    }
  }

  function onChangeText(val: string) {
    setInput(val);
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.container}
        keyboardVerticalOffset={110}>
        <ScrollView
          contentContainerStyle={!callMade && styles.scrollContentContainer}
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          style={styles.scrollContainer}>
          {!callMade && (
            <View style={styles.midChatInputWrapper}>
              <View style={styles.midChatInputContainer}>
                <TextInput
                  onChangeText={onChangeText}
                  style={styles.midInput}
                  placeholder="Describe the image you want to create..."
                  placeholderTextColor={theme.placeholderTextColor}
                  autoCorrect={true}
                  value={input}
                />
                <Pressable
                  onPress={generate}
                  disabled={loading || !input}
                  style={({ pressed }) => [
                    styles.midButtonStyle,
                    (loading || !input) && styles.buttonDisabled,
                  ]}>
                  <Ionicons
                    name="images-outline"
                    size={22}
                    color={theme.tintTextColor}
                  />
                  <Text style={styles.midButtonText}>Create</Text>
                </Pressable>
                <Text style={styles.chatDescription}>
                  Generate images using Fal.ai {MODEL_NAME}.
                </Text>
              </View>
            </View>
          )}
          {images.values.map((v) => (
            <View key={v.id} style={styles.imageContainer}>
              {v.user && (
                <View style={styles.promptTextContainer}>
                  <Pressable
                    onPress={() => copyToClipboard(v.user!)}
                    style={({ pressed }) => [
                      styles.promptTextWrapper,
                    ]}>
                    <Text style={styles.promptText}>{v.user}</Text>
                  </Pressable>
                </View>
              )}
              {v.image && (
                <View>
                  <Pressable
                    onPress={() => showClipboardActionsheet(v)}
                    style={({ pressed }) => [
                      styles.imageContainerStyle,
                    ]}>
                    <Image
                      source={{ uri: v.image }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </Pressable>
                  <View style={styles.modelLabelContainer}>
                    <Text style={styles.modelLabelText}>
                      Created with {MODEL_NAME}
                    </Text>
                  </View>
                </View>
              )}
              {!v.image && !loading && v.user && (
                <View style={styles.loadingContainer}>
                  <Text style={styles.modelLabelText}>Processing...</Text>
                </View>
              )}
            </View>
          ))}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.tintColor} />
            </View>
          )}
        </ScrollView>
        {callMade && (
          <View style={styles.chatInputContainer}>
            <TextInput
              onChangeText={onChangeText}
              style={styles.input}
              placeholder="Describe another image..."
              placeholderTextColor={theme.placeholderTextColor}
              autoCorrect={true}
              value={input}
              readOnly={loading}
            />
            <Pressable
              onPress={generate}
              disabled={loading || !input}
              style={({ pressed }) => [
                styles.buttonStyle,
                (loading || !input) && styles.buttonDisabled,
              ]}>
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.tintTextColor}
                />
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={theme.tintTextColor}
                />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    imageContainer: {
      marginBottom: 15,
    },
    chatDescription: {
      color: theme.textColor,
      textAlign: "center",
      marginTop: 15,
      fontSize: 13,
      paddingHorizontal: 34,
      opacity: 0.8,
      fontFamily: theme.regularFont,
    },
    modelLabelContainer: {
      padding: 9,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: theme.borderColor,
      paddingLeft: 13,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      marginHorizontal: 5,
    },
    modelLabelText: {
      color: theme.mutedForegroundColor || theme.textColor,
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    loadingContainer: {
      marginVertical: 25,
      justifyContent: "center",
      flexDirection: "row",
      alignItems: "center",
    },
    image: {
      width: width - 10,
      height: width - 10,
      marginTop: 5,
      marginHorizontal: 5,
      borderRadius: 8,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      backgroundColor: theme.borderColor || "#e0e0e0",
    },
    promptTextContainer: {
      alignItems: "flex-end",
      marginRight: 5,
      marginLeft: 24,
      marginBottom: 5,
    },
    promptTextWrapper: {
      borderRadius: 8,
      borderTopRightRadius: 0,
      backgroundColor: theme.tintColor,
      paddingVertical: 5,
      paddingHorizontal: 9,
      maxWidth: "90%",
    },
    promptText: {
      color: theme.tintTextColor,
      fontFamily: theme.regularFont,
      fontSize: 16,
    },
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    scrollContentContainer: {
      flexGrow: 1,
      justifyContent: "center",
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
      paddingBottom: 50,
    },
    midChatInputContainer: {
      width: "100%",
      paddingTop: 5,
      paddingBottom: 5,
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
      backgroundColor: theme.inputBackgroundColor || theme.backgroundColor,
    },
    iconContainer: {
      justifyContent: "center",
      alignItems: "center",
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 99,
      color: theme.textColor,
      marginHorizontal: 10,
      paddingVertical: 10,
      paddingHorizontal: 21,
      paddingRight: 39,
      borderColor: theme.borderColor,
      fontFamily: theme.semiBoldFont,
      backgroundColor: theme.inputBackgroundColor || theme.backgroundColor,
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
    imageContainerStyle: {
      // Base style if needed for the Pressable wrapping the image
    },
  });
