import { createContext } from 'react'
import { IThemeContext, IAppContext } from '../types'

const ThemeContext = createContext<IThemeContext>({
  theme: {},
  setTheme: () => null,
  themeName: ''
})

const AppContext = createContext<IAppContext>({})

export {
  ThemeContext, AppContext
}