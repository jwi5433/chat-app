import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { ThemeContext } from '../context';
import { useNavigation } from '@react-navigation/native';
import { CustomHeader } from '../components/CustomHeader';

export function UserProfile() {
  const { theme } = useContext(ThemeContext);
  const { user } = useUser();
  const { signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  
  const styles = getStyles(theme);
  
  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Sign Out",
          onPress: async () => {
            setLoading(true);
            try {
              await signOut();
              // The navigation will be handled automatically by the auth state change
            } catch (err) {
              console.error("Error signing out:", err);
              Alert.alert("Error", "There was a problem signing out. Please try again.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <CustomHeader showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tintColor} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader showBackButton />
      
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>
          {user.firstName || user.emailAddresses[0]?.emailAddress}
        </Text>
        <Text style={styles.userEmail}>{user.emailAddresses[0]?.emailAddress}</Text>
      </View>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('Chat')}>
          <Text style={styles.optionText}>Go to Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.optionText}>Settings</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.signOutButton} 
        onPress={handleSignOut}
        disabled={loading}
      >
        <Text style={styles.signOutText}>
          {loading ? 'Signing out...' : 'Sign Out'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColor,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    paddingTop: 40,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.tintColor,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: theme.tintTextColor,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textColor,
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 16,
    color: theme.mutedForegroundColor,
  },
  optionsContainer: {
    padding: 20,
  },
  option: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  optionText: {
    fontSize: 18,
    color: theme.textColor,
  },
  signOutButton: {
    margin: 20,
    padding: 15,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 