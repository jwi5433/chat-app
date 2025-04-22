import { createContext } from 'react'
import { IThemeContext, IAppContext } from '../types'
import { lightTheme } from './theme'

const ThemeContext = createContext<IThemeContext>({
  theme: lightTheme,
  setTheme: () => null,
  themeName: 'light'
})

const AppContext = createContext<IAppContext>({})

export {
  ThemeContext, AppContext
}