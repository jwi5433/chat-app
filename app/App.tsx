import 'react-native-gesture-handler'
// Remove the globals.css import as it's not needed for React Native
// import './src/globals.css'
import { useState, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { Main } from './src/main'
import { useFonts } from 'expo-font'
import { ThemeContext, AppContext } from './src/context'
import * as themes from './src/theme'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ActionSheetProvider } from '@expo/react-native-action-sheet'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StyleSheet, LogBox } from 'react-native'
import { ITheme } from './types'

LogBox.ignoreLogs([
  'Key "cancelled" in the image picker result is deprecated and will be removed in SDK 48, use "canceled" instead',
  'No native splash screen registered'
])

export default function App() {
  const [theme, setTheme] = useState<string>('light')
  const [fontsLoaded] = useFonts({
    'Geist-Regular': require('./assets/fonts/Geist-Regular.otf'),
    'Geist-Light': require('./assets/fonts/Geist-Light.otf'),
    'Geist-Bold': require('./assets/fonts/Geist-Bold.otf'),
    'Geist-Medium': require('./assets/fonts/Geist-Medium.otf'),
    'Geist-Black': require('./assets/fonts/Geist-Black.otf'),
    'Geist-SemiBold': require('./assets/fonts/Geist-SemiBold.otf'),
    'Geist-Thin': require('./assets/fonts/Geist-Thin.otf'),
    'Geist-UltraLight': require('./assets/fonts/Geist-UltraLight.otf'),
    'Geist-UltraBlack': require('./assets/fonts/Geist-UltraBlack.otf')
  })

  useEffect(() => {
    configureStorage()
  }, [])

  async function configureStorage() {
    try {
      const _theme = await AsyncStorage.getItem('rnai-theme')
      if (_theme) setTheme(_theme)
    } catch (err) {
      console.log('error configuring storage', err)
    }
  }

  function _setTheme(theme) {
    setTheme(theme)
    AsyncStorage.setItem('rnai-theme', theme)
  }

  if (!fontsLoaded) return null
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppContext.Provider value={{}}>
        <ThemeContext.Provider value={{
          theme: getTheme(theme),
          themeName: theme,
          setTheme: _setTheme
          }}>
          <ActionSheetProvider>
            <NavigationContainer>
              <Main />
            </NavigationContainer>
          </ActionSheetProvider>
        </ThemeContext.Provider>
      </AppContext.Provider>
    </GestureHandlerRootView>
  )
}

function getTheme(themeName: string): ITheme {
  let currentTheme = themes.lightTheme; // Default to lightTheme
  // Find theme by label, revert to original logic if problematic
  Object.keys(themes).forEach(_themeKey => {
    if (themes[_themeKey].label === themeName) { // Assuming lookup by label was intended
      currentTheme = themes[_themeKey];
    }
  });

  // Add a check to ensure a theme was found, otherwise return default
  if (!currentTheme && themeName !== themes.lightTheme.label) {
      console.warn(`[getTheme] Theme name "${themeName}" did not match any theme label, defaulting to light theme.`);
      return themes.lightTheme;
  }

  return currentTheme || themes.lightTheme; // Ensure a valid theme is always returned
}
