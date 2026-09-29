// Default InfoGata Google OAuth client. Its secret lives in the token service,
// which is why code exchange and refresh go through TOKEN_SERVER.
export const CLIENT_ID =
  "516028107316-04vdmkmjl6k67t26of3r5o9eqdcuefoa.apps.googleusercontent.com";
export const TOKEN_SERVER =
  "https://cloudflare-worker-token-service.audio-pwa.workers.dev/token";
// Used directly only when the user supplies their own client id and secret
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const SCOPE = "https://www.googleapis.com/auth/drive.appdata";

// Messages from UI to plugin
type UiCheckLogin = {
  type: "check-login";
};

type UiLogout = {
  type: "logout";
};

type UiSave = {
  type: "save";
  clientId: string;
  clientSecret: string;
};

export type UiMessageType = UiCheckLogin | UiLogout | UiSave;

// Messages from plugin to UI
type InfoType = {
  type: "info";
  clientId: string;
  clientSecret: string;
  isLoggedIn: boolean;
  redirectUri: string;
};

export type MessageType = InfoType;
