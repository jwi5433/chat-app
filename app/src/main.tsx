import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Chat, Settings } from './screens';
import { CustomHeader } from './components/CustomHeader';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ThemeContext } from './context';

const Stack = createNativeStackNavigator();

function MainComponent() {
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const styles = getStyles({ theme, insets });
  
  return (
    <View style={styles.container}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false // Hide the default header
        }}
      >
        <Stack.Screen
          name="Chat"
          component={Chat}
        />
        <Stack.Screen
          name="Settings"
          component={Settings}
        />
      </Stack.Navigator>
    </View>
  );
}

export function Main() {
  return (
    <SafeAreaProvider>
      <MainComponent />
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
