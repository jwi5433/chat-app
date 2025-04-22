import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';

// Import your existing UI components
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';

// Define the preference sequence (matching server-side)
const PREFERENCE_SEQUENCE = [
  { 
    id: "userName", 
    question: "What's your name?",
    placeholder: "Enter your name"
  },
});  { 
    id: "partnerSex", 
    question: "What gender should your flirt be?",
    placeholder: "e.g. Female, Male, Non-binary"
  },
  { 
    id: "partnerLooks", 
    question: "How should they look?",
    placeholder: "Describe their appearance"
  },
  { 
    id: "partnerTraits", 
    question: "What personality traits should they have?",
    placeholder: "Describe their personality and interests"
  },
  { 
    id: "userInterests", 
    question: "Tell us about your own interests!",
    placeholder: "Share your hobbies and interests"
  }
];

// Props definition for the component
interface PreferenceOnboardingProps {
  onComplete: (preferences: Record<string, string>) => void;
}

const PreferenceOnboarding: React.FC<PreferenceOnboardingProps> = ({ onComplete }) => {
  // State for current question index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingDots, setLoadingDots] = useState('');
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Safe area insets for proper padding
  const insets = useSafeAreaInsets();
  
  // Input ref for auto-focus
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Effect to animate transitions between questions
  useEffect(() => {
    // Focus the input when a new question appears
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  }, [currentIndex]);
  
  // Handle next question
  const handleNext = () => {
    if (!currentAnswer.trim()) return;
    
    // Animate out
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => {
      // Save answer
      const questionId = PREFERENCE_SEQUENCE[currentIndex].id;
      setAnswers(prev => ({
        ...prev,
        [questionId]: currentAnswer
      }));
      
      // Reset animation values
      slideAnim.setValue(100);
      
      // Check if we're at the last question
      if (currentIndex === PREFERENCE_SEQUENCE.length - 1) {
        // Complete the onboarding
        const finalAnswers = {
          ...answers,
          [questionId]: currentAnswer
        };
        setIsGenerating(true);
        onComplete(finalAnswers);
      } else {
        // Move to next question
        setCurrentIndex(prev => prev + 1);
        setCurrentAnswer('');
        
        // Animate in
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
          })
        ]).start();
      }
    });
  };
  
  // Current question data
  const currentQuestion = PREFERENCE_SEQUENCE[currentIndex];
  
  // Progress calculation
  const progress = ((currentIndex + 1) / PREFERENCE_SEQUENCE.length) * 100;
  
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
  
  if (isGenerating) {
    return (
      <Card className="flex flex-1 dark bg-background">
        <View style={styles.loadingContainer}>
          <View style={styles.typingBubble}>
            <Text style={styles.typingText}>
              generating flirt{loadingDots}
            </Text>
          </View>
          
          <ActivityIndicator 
            size="large" 
            color="#F7B5CD"
            style={styles.spinner} 
          />
        </View>
      </Card>
    );
  }
  
  return (
    <Card className="flex flex-1 dark">
      <KeyboardAvoidingView
        style={[styles.container, { 
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${progress}%`,
              }
            ]} 
          />
        </View>
        
        <ScrollArea className="flex-1 px-5 pt-10">
          {/* Question */}
          <Animated.View 
            style={[
              styles.questionContainer,
              {
                transform: [{ translateX: slideAnim }],
                opacity: fadeAnim
              }
            ]}
          >
            <Text style={styles.questionText}>
              {currentQuestion.question}
            </Text>
            
            <Input
              ref={inputRef}
              className="bg-secondary border-0 rounded-full py-4 px-4 text-foreground"
              placeholder={currentQuestion.placeholder}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              multiline={currentQuestion.id === 'partnerLooks' || currentQuestion.id === 'partnerTraits' || currentQuestion.id === 'userInterests'}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && 
                    currentQuestion.id !== 'partnerLooks' && 
                    currentQuestion.id !== 'partnerTraits' && 
                    currentQuestion.id !== 'userInterests') {
                  handleNext();
                }
              }}
            />
          </Animated.View>
        </ScrollArea>
        
        {/* Submit button */}
        <View style={styles.inputContainer}>
          <Button
            onClick={handleNext}
            size="icon"
            className={`rounded-full ${currentAnswer.trim() ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/80'}`}
            disabled={!currentAnswer.trim()}
          >
            <Send size={20} color={currentAnswer.trim() ? '#FFFFFF' : '#121212'} />
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    height: 6,
    overflow: 'hidden',
    backgroundColor: '#333333',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#F7B5CD',
  },
  questionContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 22,
    marginBottom: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center'
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  typingBubble: {
    backgroundColor: '#F7B5CD', // Same pink as chat bubbles
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 30,
  },
  typingText: {
    color: '#121212',
    fontSize: 16,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  spinner: {
    marginTop: 20,
  },
});