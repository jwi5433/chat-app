import * as React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context';
import { useContext } from 'react';

export function SignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigation = useNavigation<any>();
  const { theme } = useContext(ThemeContext);
  
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  
  const styles = getStyles(theme);

  // Validate password strength
  const validatePassword = (password: string) => {
    setPasswordError('');
    
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return false;
    }
    
    if (!/[A-Z]/.test(password)) {
      setPasswordError('Password must contain at least one uppercase letter');
      return false;
    }
    
    if (!/[a-z]/.test(password)) {
      setPasswordError('Password must contain at least one lowercase letter');
      return false;
    }
    
    if (!/[0-9]/.test(password)) {
      setPasswordError('Password must contain at least one number');
      return false;
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      setPasswordError('Password must contain at least one special character');
      return false;
    }
    
    return true;
  };

  const onSignUpPress = async () => {
    if (!isLoaded || loading) return;
    
    setLoading(true);
    setError('');
    
    // Validate username
    if (!username || username.length < 3) {
      setError('Please enter a valid username (at least 3 characters)');
      setLoading(false);
      return;
    }
    
    // Validate password
    if (!validatePassword(password)) {
      setLoading(false);
      return;
    }
    
    try {
      // Create the user
      await signUp.create({
        username: username,
        password,
      });
      
      // Prepare verification if needed
      // Note: For username-only auth, you might not need email verification
      // If you do need verification, adjust this part based on your Clerk configuration
      if (signUp.status === 'complete') {
        await setActive({ session: signUp.createdSessionId });
        navigation.navigate('Chat');
      } else {
        console.log(JSON.stringify(signUp, null, 2));
        // If Clerk requires additional verification, handle it here
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      
      if (err.errors) {
        // Handle specific Clerk errors
        const clerkError = err.errors[0];
        if (clerkError.code === 'form_password_pwned') {
          setPasswordError('This password has been found in a data breach. Please use a different password.');
        } else if (clerkError.code === 'form_identifier_exists') {
          setError('An account with this username already exists.');
        } else if (clerkError.meta?.paramName === 'username') {
          setError(`Username error: ${clerkError.message}`);
        } else if (clerkError.meta?.paramName === 'password') {
          setPasswordError(`Password error: ${clerkError.message}`);
        } else {
          setError(clerkError.message || 'An error occurred during sign up');
        }
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const onVerifyPress = async () => {
    if (!isLoaded || loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      // This section may not be needed for username-only auth
      // Adjust based on your Clerk configuration
      if (signUp.status === 'complete') {
        await setActive({ session: signUp.createdSessionId });
        navigation.navigate('Chat');
      } else {
        console.log(JSON.stringify(signUp, null, 2));
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      
      if (err.errors && err.errors[0]) {
        setError(err.errors[0].message || 'Verification failed');
      } else {
        setError('An error occurred during verification');
      }
    } finally {
      setLoading(false);
    }
  };

  // For username-only auth, you'll likely not need the verification UI
  // Keeping it simple for now - adjust based on your Clerk configuration
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={username}
        placeholder="Username"
        placeholderTextColor={theme.placeholderTextColor}
        onChangeText={(text) => setUsername(text)}
        autoComplete="username"
      />
      
      <TextInput
        style={styles.input}
        value={password}
        placeholder="Password"
        placeholderTextColor={theme.placeholderTextColor}
        secureTextEntry={true}
        onChangeText={(pwd) => setPassword(pwd)}
        autoComplete="new-password"
      />
      
      {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
      
      <Text style={styles.passwordHint}>
        Password must contain at least 8 characters, including uppercase, lowercase, 
        number, and special character.
      </Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={onSignUpPress}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.linkText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.backgroundColor,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: theme.textColor,
    textAlign: 'center',
  },
  description: {
    color: theme.textColor,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.responseBackgroundColor,
    color: theme.textColor,
    borderRadius: 8,
    padding: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  button: {
    backgroundColor: theme.tintColor,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: theme.tintTextColor,
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 5,
  },
  footerText: {
    color: theme.textColor,
  },
  linkText: {
    color: theme.tintColor,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  passwordHint: {
    color: theme.textColor,
    opacity: 0.7,
    fontSize: 12,
    marginBottom: 15,
    textAlign: 'center',
  }
}); 