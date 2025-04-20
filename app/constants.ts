import { GeminiIcon } from './src/components/GeminiIcon'

export const DOMAIN = process.env.EXPO_PUBLIC_ENV === 'DEVELOPMENT' ?
  process.env.EXPO_PUBLIC_DEV_API_URL :
  process.env.EXPO_PUBLIC_PROD_API_URL

export const MODELS = {
  gemini: { name: 'Gemini', label: 'gemini', icon: GeminiIcon },
}

export const IMAGE_MODELS = {
  fluxPro: {
    name: "FLUX Pro",
    label: "flux-pro",
  },
}