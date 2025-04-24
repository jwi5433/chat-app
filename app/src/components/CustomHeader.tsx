import React, { useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context';
import FeatherIcon from '@expo/vector-icons/Feather';
import { useAuth } from '@clerk/clerk-expo';

interface CustomHeaderProps {
  showBackButton?: boolean;
}

export function CustomHeader({ showBackButton }: CustomHeaderProps) {
  const { theme } = useContext(ThemeContext);
  const navigation = useNavigation<any>();
  let isSignedIn = false;
  
  try {
    // Wrap Clerk's useAuth in a try/catch to prevent errors if ClerkProvider is not available
    const authInfo = useAuth();
    isSignedIn = authInfo?.isSignedIn || false;
  } catch (error) {
    // If ClerkProvider is not available, isSignedIn will remain false
    console.log('Auth context not available');
  }
  
  const styles = getStyles(theme);

  const handleBackPress = () => {
    navigation.goBack();
  };
  
  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
  };

  // Avatar URL for the AI
  const avatarUrl = "https://ui-avatars.com/api/?name=AI&background=d53f8c&color=fff";

  return (
    <View style={styles.container}>
      {/* Left side - back button or empty */}
      <View style={styles.leftContainer}>
        {showBackButton && (
          <TouchableOpacity onPress={handleBackPress} style={styles.iconButton}>
            <FeatherIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Center - title and avatar */}
      <View style={styles.centerContainer}>
        <Image 
          source={{ uri: avatarUrl }}
          style={styles.avatar}
        />
        <Text style={styles.title}>AI Chat</Text>
      </View>
      
      {/* Right side - profile button or empty */}
      <View style={styles.rightContainer}>
        {isSignedIn && (
          <TouchableOpacity onPress={handleProfilePress} style={styles.iconButton}>
            <FeatherIcon name="user" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: '#d53f8c', // Dark pink color from theme
    },
    leftContainer: {
      width: 40,
    },
    centerContainer: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    rightContainer: {
      width: 40,
      alignItems: 'flex-end',
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff', // White text
      marginLeft: 8,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#fff',
    },
    iconButton: {
      padding: 8,
    },
  });
} 