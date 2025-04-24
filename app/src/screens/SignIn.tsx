import * as React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context';
import { useContext } from 'react';

export function SignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigation = useNavigation<any>();
  const { theme } = useContext(ThemeContext);
  
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  const styles = getStyles(theme);

  const onSignInPress = async () => {
    if (!isLoaded || loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      const signInAttempt = await signIn.create({
        identifier: username,
        password,
      });
      
      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        navigation.navigate('Chat');
      } else {
        console.log(JSON.stringify(signInAttempt, null, 2));
        setError('Something went wrong during sign in');
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      setError(err.errors?.[0]?.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      
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
        onChangeText={(password) => setPassword(password)}
        autoComplete="current-password"
      />
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={onSignInPress}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.linkText}>Sign Up</Text>
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
  }
}); 