import { SetStateAction, Dispatch } from 'react'

export interface IIconProps {
  type: string
  props: any
}

// Define a specific type for the theme object
export interface ITheme {
  name: string;
  label: string;
  textColor: string;
  secondaryTextColor: string;
  mutedForegroundColor: string;
  backgroundColor: string;
  placeholderTextColor: string;
  secondaryBackgroundColor: string;
  responseBackgroundColor: string;
  borderColor: string;
  tintColor: string;
  tintTextColor: string;
  tabBarActiveTintColor: string;
  tabBarInactiveTintColor: string;
  regularFont: string;
  lightFont: string;
  mediumFont: string;
  boldFont: string;
  semiBoldFont: string;
  ultraLightFont: string;
  thinFont: string;
  blackFont: string;
  ultraBlackFont: string;
  inputBackgroundColor?: string;
  disabledColor?: string;
}

export interface IThemeContext {
  theme: ITheme;
  setTheme: Dispatch<SetStateAction<string>>;
  themeName: string;
}

export interface IAppContext {
  // Removed chatType
  // Removed setChatType
}