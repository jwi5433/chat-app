import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Chat, Settings, SignIn, SignUp, UserProfile } from './screens';
import { CustomHeader } from './components/CustomHeader';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ThemeContext } from './context';
import { useAuth } from '@clerk/clerk-expo';
import { ClerkProvider } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

const Stack = createNativeStackNavigator();

// Token cache for Clerk
const tokenCache = {
  async getToken(key) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

function MainComponent() {
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { isLoaded, isSignedIn } = useAuth();
  const [initializing, setInitializing] = useState(true);
  
  const styles = getStyles({ theme, insets });
  
  useEffect(() => {
    if (isLoaded) {
      setInitializing(false);
    }
  }, [isLoaded]);
  
  if (initializing) {
    // You could add a loading screen here
    return null;
  }
  
  return (
    <View style={styles.container}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false // Hide the default header
        }}
      >
        {isSignedIn ? (
          // Authenticated routes
          <React.Fragment>
            <Stack.Screen
              name="Chat"
              component={Chat}
            />
            <Stack.Screen
              name="Settings"
              component={Settings}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfile}
            />
          </React.Fragment>
        ) : (
          // Unauthenticated routes
          <React.Fragment>
            <Stack.Screen
              name="SignIn"
              component={SignIn}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUp}
            />
          </React.Fragment>
        )}
      </Stack.Navigator>
    </View>
  );
}

export function Main() {
  return (
    <SafeAreaProvider>
      <ClerkProvider 
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "your_publishable_key_here"}
        tokenCache={tokenCache}
      >
        <MainComponent />
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

const getStyles = ({ theme, insets } : { theme: any, insets: any}) => StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundColor,
    flex: 1,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  },
});
