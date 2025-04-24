import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  Modal,
  Pressable
} from 'react-native';
import { Send } from 'lucide-react-native';

// Define message type
export type MessageType = {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp?: string | Date;
  image?: string;
};

type AiProfileType = {
  name: string;
  avatar: string;
};

// This component expects to receive messages and other data as props
export default function FlirtChat({ 
  messages = [], 
  onSendMessage, 
  aiProfile = { name: 'AI Assistant', avatar: 'https://ui-avatars.com/api/?name=AI&background=d53f8c&color=fff' },
  isGenerating = false,
  isFirstMessage = true 
}: {
  messages: MessageType[];
  onSendMessage: (message: string) => void;
  aiProfile?: AiProfileType;
  isGenerating?: boolean;
  isFirstMessage?: boolean;
}) {
  const [newMessage, setNewMessage] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Add small visual feedback when button is pressed
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  
  // State for the animated dots
  const [loadingDots, setLoadingDots] = useState('');
  
  // State to track if this is the first loading indicator shown
  const [isFirstLoading, setIsFirstLoading] = useState(true);

  // State for full-screen image view
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Function to handle image tapping
  const handleImageTap = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setModalVisible(true);
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, loadingDots]);

  // Determine if submit button should be active style
  const canSubmit = newMessage.trim().length > 0;
  
  // Detect if this is the first message in the conversation
  useEffect(() => {
    setIsFirstLoading(messages.length === 0);
  }, [messages.length]);
  
  // Always scroll to the typing indicator when it appears
  useEffect(() => {
    if (isGenerating && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [isGenerating, loadingDots]);
  
  // Animate the loading dots
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev === '...') return '';
          return prev + '.';
        });
      }, 500);
      
      return () => clearInterval(interval);
    } else {
      setLoadingDots('');
    }
  }, [isGenerating]);

  return (
    <View style={styles.container}>
      {/* Header with centered avatar */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: aiProfile.avatar }} 
            style={styles.headerAvatar}
            resizeMode="cover"
          />
          <Text style={styles.headerTitle}>{aiProfile.name}</Text>
        </View>
      </View>
      
      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
      >
        {messages.map((message) => (
          <View 
            key={message.id} 
            style={[
              styles.messageRow,
              message.sender === 'user' ? styles.userMessageRow : styles.botMessageRow
            ]}
          >
            {message.sender !== 'user' && (
              <Image 
                source={{ uri: aiProfile.avatar }} 
                style={styles.messageAvatar}
                resizeMode="cover"
              />
            )}
            <View style={styles.messageContentWrapper}>
              <View 
                style={[
                  styles.messageBubble,
                  message.sender === 'user' ? styles.userBubble : styles.botBubble
                ]}
              >
                {message.content ? (
                  <Text style={message.sender === 'user' ? styles.userText : styles.botText}>
                    {message.content}
                  </Text>
                ) : message.sender === 'assistant' && !message.image ? (
                  <Text style={styles.botText}>...</Text>
                ) : null}
                
                {message.image && (
                  <Pressable 
                    style={styles.messageImageContainer}
                    onPress={() => handleImageTap(message.image || '')}
                  >
                    <Image
                      source={{ uri: message.image }}
                      style={[
                        styles.messageImage,
                        // Adjust margin if there's content above
                        message.content ? { marginTop: 8 } : { marginTop: 0 }
                      ]}
                      resizeMode="cover"
                      onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                    />
                  </Pressable>
                )}
              </View>
              {message.timestamp && (
                <Text 
                  style={[
                    styles.timestamp,
                    message.sender === 'user' ? styles.userTimestamp : styles.botTimestamp
                  ]}
                >
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          </View>
        ))}
        
        {/* Show iPhone-style typing indicator at the end of the message list if generating */}
        {isGenerating && (
          <View style={styles.loadingContainer}>
            <Image 
              source={{ uri: aiProfile.avatar }} 
              style={styles.messageAvatar}
              resizeMode="cover"
            />
            <View style={styles.messageContentWrapper}>
              <View style={styles.typingBubble}>
                {isFirstLoading ? (
                  <Text style={styles.typingText}>
                    generating flirt{loadingDots}
                  </Text>
                ) : (
                  <View style={styles.typingDots}>
                    <View style={[styles.typingDot, { opacity: loadingDots.length >= 1 ? 1 : 0.3 }]} />
                    <View style={[styles.typingDot, { opacity: loadingDots.length >= 2 ? 1 : 0.3 }]} />
                    <View style={[styles.typingDot, { opacity: loadingDots.length >= 3 ? 1 : 0.3 }]} />
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      
      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={[styles.inputWrapper, canSubmit && styles.inputWrapperActive]}>
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Message..."
            placeholderTextColor="#999"
            style={styles.input}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
            selectionColor="#F7B5CD" // This makes the cursor pink
          />
        </View>
        <TouchableOpacity
          onPress={handleSendMessage}
          style={[
            styles.sendButton,
            !canSubmit && styles.sendButtonDisabled,
            canSubmit && styles.sendButtonActive,
            isButtonPressed && styles.sendButtonPressed
          ]}
          activeOpacity={0.6}
          disabled={!canSubmit}
          onPressIn={() => setIsButtonPressed(true)}
          onPressOut={() => setIsButtonPressed(false)}
        >
          <Send size={20} color={canSubmit ? '#FFFFFF' : '#121212'} />
        </TouchableOpacity>
      </View>
      
      {/* Full Screen Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={[styles.modalContainer, { pointerEvents: 'auto' }]}
          onPress={() => setModalVisible(false)}
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.modalCloseText}>
            Tap anywhere to close
          </Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212'
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#121212',
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  headerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 2,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 32
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  botMessageRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageContentWrapper: {
    flexDirection: 'column',
    maxWidth: width * 0.75,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  userBubble: {
    backgroundColor: '#333333', // Gray for user messages
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#F7B5CD', // Lighter pink for AI messages
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: 'white',
  },
  botText: {
    color: '#121212', // Darker text for better contrast on light pink
  },
  messageImage: {
    width: '100%',
    minWidth: Math.min(width * 0.6, 300),
    height: undefined,
    aspectRatio: 1.2,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    color: '#999',
  },
  userTimestamp: {
    alignSelf: 'flex-end',
  },
  botTimestamp: {
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#121212',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 8,
    borderWidth: 0,
  },
  inputWrapperActive: {
    backgroundColor: '#3a3a3a', // Slightly lighter when text is entered
  },
  input: {
    height: 40,
    color: 'white',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7B5CD', // Exact same color as AI bubbles
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#d53f8c', // Darker pink when input is available
  },
  sendButtonDisabled: {
    backgroundColor: '#b68599', // Darker version of the light pink
  },
  sendButtonPressed: {
    backgroundColor: '#ffc6de', // Lighter version of the light pink
    transform: [{ scale: 0.95 }], // Slight scale down when pressed
  },
  loadingContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    marginTop: 4, // Add a small gap from the last message
  },
  typingBubble: {
    backgroundColor: '#F7B5CD', // Same as AI bubbles
    padding: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    minWidth: 40,
  },
  typingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 15,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#121212',
    marginHorizontal: 2,
  },
  typingText: {
    color: '#121212',
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 2,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: 5,
  },
  modalCloseText: { 
    color: 'white', 
    position: 'absolute',
    bottom: 40,
    opacity: 0.8,
  },
  messageImageContainer: {
    width: '100%',
    alignItems: 'center',
  },
}); 