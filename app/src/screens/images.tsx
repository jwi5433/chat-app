import {
  View,
  Text,
  TouchableHighlight,
  KeyboardAvoidingView,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Keyboard,
  Image,
} from "react-native";
import { useState, useRef, useContext } from "react";
import {
  DOMAIN,
  IMAGE_MODELS,
  ILLUSION_DIFFUSION_IMAGES,
} from "../../constants";
import { v4 as uuid } from "uuid";
import { ThemeContext, AppContext } from "../context";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useActionSheet } from "@expo/react-native-action-sheet";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
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

export function Images() {
  const [callMade, setCallMade] = useState(false);
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  const [input, setInput] = useState("");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<any>(null);
  const [images, setImages] = useState<ImagesState>({
    index: uuid,
    values: [],
  });
  const { handlePresentModalPress, closeModal, imageModel, illusionImage } =
    useContext(AppContext);

  const { showActionSheetWithOptions } = useActionSheet();

  const imageModelConfig = Object.values(IMAGE_MODELS).find(
    (m) => m.label === imageModel
  );
  const hideInput =
    imageModelConfig?.label === IMAGE_MODELS.removeBg.label ||
    imageModelConfig?.label === IMAGE_MODELS.upscale.label;
  const buttonLabel =
    imageModelConfig?.label === IMAGE_MODELS.removeBg.label
      ? "Remove background"
      : "Upscale";

  async function generate() {
    if (loading) return;

    const modelLabel: string = imageModel;
    const modelConfig = Object.values(IMAGE_MODELS).find(
      (m) => m.label === modelLabel
    );

    if (!modelConfig) {
      console.error(
        `[generate] Error: Could not find configuration for image model label: ${modelLabel}`
      );
      return;
    }

    const requiresImageUpload =
      modelConfig.label === IMAGE_MODELS.removeBg.label ||
      modelConfig.label === IMAGE_MODELS.upscale.label;

    if (requiresImageUpload && !image) {
      console.log(`No image selected for model: ${modelConfig.name}`);
      return;
    } else if (!requiresImageUpload && !input) {
      console.log(`No prompt input for model: ${modelConfig.name}`);
      return;
    }

    Keyboard.dismiss();
    const imageCopy: any = image;
    const currentModelName: string = modelConfig.name;

    const newItemId = uuid(); // Generate ID upfront

    try {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 1);
      setCallMade(true);

      const newItem: ImageLogItem = {
        id: newItemId,
        ...(!requiresImageUpload && { user: input }),
      };

      setImages((prevImages) => ({
        index: prevImages.index,
        values: [...prevImages.values, newItem], // Add placeholder
      }));

      const body: Record<string, any> = {
        model: modelLabel,
        ...(!requiresImageUpload && { prompt: input }),
      };

      setLoading(true);
      setImage(null);
      setInput("");

      interface ApiResponse {
        image?: string;
        error?: string;
      }

      let response: ApiResponse;

      if (requiresImageUpload && imageCopy) {
        const formData = new FormData();
        const fileData = {
          uri: imageCopy.uri.replace("file://", ""),
          name: imageCopy.fileName || `${uuid()}.jpg`,
          type: imageCopy.mimeType || "image/jpeg",
        };
        formData.append("file", fileData as any);
        for (const key in body) {
          formData.append(key, String(body[key]));
        }

        response = await fetch(`${DOMAIN}/images/fal`, {
          method: "POST",
          body: formData,
        }).then((res) => res.json() as Promise<ApiResponse>);
      } else {
        if (modelLabel === IMAGE_MODELS.illusionDiffusion.label) {
          if (!illusionImage) {
            console.error(
              "Illusion Diffusion selected but no base image chosen in settings!"
            );
            setLoading(false);
            setImages((prevImages) => ({
              ...prevImages,
              values: prevImages.values.filter((item) => item.id !== newItemId),
            })); // Remove placeholder
            return;
          }
          body.baseImage = ILLUSION_DIFFUSION_IMAGES[illusionImage].image;
        }

        response = await fetch(`${DOMAIN}/images/fal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }).then((res) => res.json() as Promise<ApiResponse>);
      }

      if (response.image) {
        setImages((prevImages) => {
          const updatedValues = prevImages.values.map((item) => {
            if (item.id === newItemId) {
              return {
                ...item,
                image: response.image,
                model: currentModelName,
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
          values: prevImages.values.filter((item) => item.id !== newItemId), // Remove placeholder by ID
        }));
        alert(`Error: ${response.error || "Unknown API error"}`);
      }
    } catch (err: any) {
      setLoading(false);
      console.error("Error generating image (Catch block):", err);
      setImages((prevImages) => ({
        index: prevImages.index,
        values: prevImages.values.filter((item) => item.id !== newItemId), // Remove placeholder by ID
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
  }

  async function showClipboardActionsheet(d: ImageLogItem) {
    closeModal();
    const options = ["Save image", "Clear prompts", "Cancel"];
    const cancelButtonIndex = 2;
    const destructiveButtonIndex = 1; // Example: Make 'Clear prompts' red

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex, // Optional: if you want a destructive action style
      },
      (selectedIndex?: number) => {
        // selectedIndex can be undefined if dismissed
        if (selectedIndex === 0 && d.image) {
          console.log("saving image ...");
          downloadImageToDevice(d.image);
        } else if (selectedIndex === 1) {
          clearPrompts();
        }
      }
    );
  }

  async function downloadImageToDevice(url: string) {
    try {
      const fileUri = FileSystem.documentDirectory + uuid() + ".png";
      console.log(`Downloading to: ${fileUri}`); // Log download path
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      console.log("Finished downloading to ", uri);
      // You might want to save it to the camera roll here using MediaLibrary
      // import * as MediaLibrary from 'expo-media-library';
      // const permission = await MediaLibrary.requestPermissionsAsync();
      // if (permission.granted) {
      //   await MediaLibrary.saveToLibraryAsync(uri);
      //   alert('Image saved to gallery!');
      // } else {
      //   alert('Permission required to save image.');
      // }
      alert("Image downloaded. Check app files."); // Simple alert for now
    } catch (e) {
      console.error("Error downloading image:", e);
      alert("Failed to download image.");
    }
  }

  function onChangeText(val: string) {
    setInput(val);
  }

  async function chooseImage() {
    try {
      let res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!res || res.canceled || !res.assets || res.assets.length === 0) {
        console.log("Image selection cancelled or failed");
        return;
      }
      setImage(res.assets[0]);
    } catch (err) {
      console.log("Error choosing image:", err);
      alert("Failed to choose image.");
    }
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
                {!hideInput && (
                  <>
                    <TextInput
                      onChangeText={onChangeText}
                      style={styles.midInput}
                      placeholder="What do you want to create?"
                      placeholderTextColor={theme.placeholderTextColor}
                      autoCorrect={true}
                      value={input}
                    />
                    <TouchableHighlight
                      onPress={generate}
                      underlayColor={"transparent"}
                      onLongPress={() => {
                        Keyboard.dismiss();
                        handlePresentModalPress();
                      }}>
                      <View style={styles.midButtonStyle}>
                        <Ionicons
                          name="images-outline"
                          size={22}
                          color={theme.tintTextColor}
                        />
                        <Text style={styles.midButtonText}>Create</Text>
                      </View>
                    </TouchableHighlight>
                  </>
                )}
                {hideInput && (
                  <TouchableHighlight
                    onPress={image ? generate : chooseImage}
                    underlayColor={"transparent"}
                    onLongPress={() => {
                      Keyboard.dismiss();
                      handlePresentModalPress();
                    }}>
                    <View style={styles.midButtonStyle}>
                      <Ionicons
                        name="images-outline"
                        size={22}
                        color={theme.tintTextColor}
                      />
                      <Text style={styles.midButtonText}>
                        {image ? buttonLabel : "Choose image"}
                      </Text>
                    </View>
                  </TouchableHighlight>
                )}
                {image && (
                  <View style={styles.midFileNameContainer}>
                    <Text
                      style={styles.fileName}
                      numberOfLines={1}
                      ellipsizeMode="middle">
                      {image.fileName ||
                        image.uri?.split("/").pop() ||
                        "Image Selected"}
                    </Text>
                    <TouchableHighlight
                      onPress={() => setImage(null)}
                      style={styles.closeIconContainer}
                      underlayColor={"transparent"}>
                      <MaterialIcons
                        style={styles.closeIcon}
                        name="close"
                        color={theme.textColor}
                        size={14}
                      />
                    </TouchableHighlight>
                  </View>
                )}
                <Text style={styles.chatDescription}>
                  Generate images and art using natural language. Choose from a
                  variety of models.
                </Text>
              </View>
            </View>
          )}
          {images.values.map((v) => (
            <View key={v.id} style={styles.imageContainer}>
              {v.user && (
                <View style={styles.promptTextContainer}>
                  <TouchableHighlight
                    underlayColor={"transparent"}
                    onPress={() => copyToClipboard(v.user!)}>
                    <View style={styles.promptTextWrapper}>
                      <Text style={styles.promptText}>{v.user}</Text>
                    </View>
                  </TouchableHighlight>
                </View>
              )}
              {v.image && (
                <View>
                  <TouchableHighlight
                    onPress={() => showClipboardActionsheet(v)}
                    underlayColor={"transparent"}>
                    <Image
                      source={{ uri: v.image }}
                      style={styles.image}
                      resizeMode="contain" // Keep aspect ratio
                    />
                  </TouchableHighlight>
                  <View style={styles.modelLabelContainer}>
                    <Text style={styles.modelLabelText}>
                      Created with Fal.ai model {v.model || "Unknown"}
                    </Text>
                  </View>
                </View>
              )}
              {/* Add a small indicator if item is pending but not loading overall */}
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
          <>
            {!hideInput && (
              <View style={styles.chatInputContainer}>
                <TextInput
                  onChangeText={onChangeText}
                  style={styles.input}
                  placeholder="What else do you want to create?"
                  placeholderTextColor={theme.placeholderTextColor}
                  autoCorrect={true}
                  value={input}
                  editable={!loading} // Disable input while loading
                />
                <TouchableHighlight
                  onPress={generate}
                  underlayColor={"transparent"}
                  disabled={loading || !input} // Disable button while loading or if input empty
                  onLongPress={
                    !loading
                      ? () => {
                          Keyboard.dismiss();
                          handlePresentModalPress();
                        }
                      : undefined
                  }>
                  <View
                    style={[
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
                  </View>
                </TouchableHighlight>
              </View>
            )}
            {hideInput && (
              <TouchableHighlight
                onPress={image ? generate : chooseImage}
                underlayColor={"transparent"}
                disabled={loading} // Disable while loading
                onLongPress={
                  !loading
                    ? () => {
                        Keyboard.dismiss();
                        handlePresentModalPress();
                      }
                    : undefined
                }>
                <View
                  style={[
                    styles.bottomButtonStyle,
                    loading && styles.buttonDisabled,
                  ]}>
                  {loading ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.tintTextColor}
                    />
                  ) : (
                    <Ionicons
                      name="images-outline"
                      size={22}
                      color={theme.tintTextColor}
                    />
                  )}
                  <Text style={styles.midButtonText}>
                    {loading
                      ? "Processing..."
                      : image
                      ? buttonLabel
                      : "Choose image"}
                  </Text>
                </View>
              </TouchableHighlight>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// --- Styles ---
const getStyles = (theme: any) =>
  StyleSheet.create({
    // Add type for theme if available
    closeIcon: {
      borderWidth: 1,
      padding: 4,
      backgroundColor: theme.backgroundColor,
      borderColor: theme.borderColor,
      borderRadius: 15,
    },
    closeIconContainer: {
      position: "absolute",
      right: -15,
      top: -17,
      padding: 10,
      backgroundColor: "transparent",
      borderRadius: 25,
      zIndex: 1, // Ensure it's clickable above text
    },
    fileName: {
      color: theme.textColor,
      marginRight: 15, // Add margin so close icon doesn't overlap text
    },
    midFileNameContainer: {
      marginTop: 20,
      marginHorizontal: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 7,
      position: "relative", // Needed for absolute positioning of close icon
    },
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
      color: theme.mutedForegroundColor || theme.textColor, // Fallback color
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
      height: width - 10, // Make height same as width for square aspect ratio
      marginTop: 5,
      marginHorizontal: 5,
      borderRadius: 8,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      backgroundColor: theme.borderColor || "#e0e0e0", // Placeholder background
    },
    promptTextContainer: {
      alignItems: "flex-end", // Keep user prompts to the right
      marginRight: 5,
      marginLeft: 24, // Add left margin for spacing
      marginBottom: 5,
    },
    promptTextWrapper: {
      borderRadius: 8,
      borderTopRightRadius: 0, // Keep the chat bubble style
      backgroundColor: theme.tintColor,
      paddingVertical: 5,
      paddingHorizontal: 9,
      maxWidth: "90%", // Prevent text from taking full width
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
      flexGrow: 1, // Allow content to grow and enable scrolling
      justifyContent: "center", // Center initial content vertically
    },
    scrollContainer: {
      flex: 1, // Ensure ScrollView takes up available space
      paddingTop: 10,
    },
    chatInputContainer: {
      paddingTop: 5,
      borderTopWidth: 1, // Add top border
      borderColor: theme.borderColor,
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 5,
      paddingHorizontal: 5, // Add horizontal padding
      backgroundColor: theme.backgroundColor, // Match background
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
      paddingBottom: 50, // Add padding at the bottom
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
      backgroundColor: theme.inputBackgroundColor || theme.backgroundColor, // Input background
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
      paddingRight: 39, // Make space for the button
      borderColor: theme.borderColor,
      fontFamily: theme.semiBoldFont,
      backgroundColor: theme.inputBackgroundColor || theme.backgroundColor, // Input background
    },
    bottomButtonStyle: {
      marginVertical: 5,
      flexDirection: "row",
      marginHorizontal: 6,
      paddingHorizontal: 15, // Increased padding
      paddingVertical: 12, // Increased padding
      borderRadius: 99, // Make it round like mid button
      backgroundColor: theme.tintColor,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonStyle: {
      marginRight: 5, // Reduced margin
      padding: 8, // Slightly larger padding
      borderRadius: 99,
      backgroundColor: theme.tintColor,
      justifyContent: "center",
      alignItems: "center",
      width: 38, // Fixed width
      height: 38, // Fixed height
    },
    buttonDisabled: {
      backgroundColor: theme.disabledColor || "#cccccc", // Use a theme disabled color or default gray
      opacity: 0.7,
    },
    buttonText: {
      // This style seems unused, can be removed if not needed elsewhere
      color: theme.textColor,
      fontFamily: theme.mediumFont,
    },
  });
