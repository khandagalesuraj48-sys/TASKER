export type SupportedLanguage = 
  | 'en' // English
  | 'hi' // Hindi (हिन्दी)
  | 'mr' // Marathi (मराठी)
  | 'ta' // Tamil (தமிழ்)
  | 'te' // Telugu (తెలుగు)
  | 'bn' // Bengali (বাংলা)
  | 'gu' // Gujarati (ગુજરાતી)
  | 'kn' // Kannada (ಕನ್ನಡ)
  | 'ml' // Malayalam (മലയാളം)
  | 'pa'; // Punjabi (ਪੰਜਾਬੀ)

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  script: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', script: 'Latin' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', script: 'Devanagari' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', script: 'Bengali' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi' },
];
