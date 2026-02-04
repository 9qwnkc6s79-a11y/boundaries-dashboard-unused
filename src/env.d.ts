/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOAST_CLIENT_ID: string;
  readonly VITE_TOAST_CLIENT_SECRET: string;
  readonly VITE_TOAST_RESTAURANT_GUID: string;
  readonly VITE_TOAST_LOCATION_GUIDS?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
