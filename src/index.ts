import {
  AUTH_URL,
  CLIENT_ID,
  MessageType,
  SCOPE,
  TOKEN_SERVER,
  TOKEN_URL,
  UiMessageType,
} from "./shared";

// Google Drive API endpoints
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

// Storage keys
const TOKEN_KEY = "gdrive_access_token";
const REFRESH_TOKEN_KEY = "gdrive_refresh_token";
const EXPIRES_AT_KEY = "gdrive_expires_at";
const CLIENT_ID_KEY = "gdrive_client_id";
const CLIENT_SECRET_KEY = "gdrive_client_secret";
const FILE_ID_KEY_PREFIX = "gdrive_file_id:";

const NOT_AUTHENTICATED = "Not authenticated with Google Drive";

// Refresh this long before the token actually expires
const EXPIRY_MARGIN_MS = 60 * 1000;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Get the parent origin by stripping the pluginId subdomain.
 * e.g. pluginId.localhost:3001 -> http://localhost:3001
 *      pluginId.audiogata.com -> https://audiogata.com
 */
const getParentOrigin = (): string => {
  const url = new URL(window.location.origin);
  const parts = url.hostname.split(".");
  parts.shift();
  url.hostname = parts.join(".");
  return url.origin;
};

const getRedirectUri = (): string => `${getParentOrigin()}/login_popup.html`;

/**
 * The OAuth client to use. The user's own client is only usable with both an
 * id and a secret, since Google's token endpoint requires the secret. Without
 * them the default client is used and its secret is added by the token service.
 */
const getClient = (): { clientId: string; clientSecret?: string; tokenUrl: string } => {
  const clientId = localStorage.getItem(CLIENT_ID_KEY);
  const clientSecret = localStorage.getItem(CLIENT_SECRET_KEY);
  if (clientId && clientSecret) {
    return { clientId, clientSecret, tokenUrl: TOKEN_URL };
  }
  return { clientId: CLIENT_ID, tokenUrl: TOKEN_SERVER };
};

/**
 * Check if user has a stored access token
 */
const hasLogin = (): boolean => {
  return !!localStorage.getItem(TOKEN_KEY);
};

/**
 * Convert Base64 string to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Convert Uint8Array to Base64 string
 */
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * The file a document is kept in. AudioGata names its documents itself
 * ("audiogata-library"), so the name only needs making safe for Drive.
 */
const getFileName = (docUrl: string): string =>
  `${docUrl.replace(/[^a-zA-Z0-9_-]/g, "-")}.automerge`;

/**
 * Read an error message out of a Google API error response
 */
const readError = async (response: Response, fallback: string): Promise<string> => {
  const errorText = await response.text();
  try {
    const errorJson = JSON.parse(errorText);
    return (
      errorJson.error?.message ||
      errorJson.error_description ||
      (typeof errorJson.error === "string" ? errorJson.error : "") ||
      fallback
    );
  } catch {
    return fallback;
  }
};

// ============================================
// Token Management
// ============================================

const setTokens = (tokens: TokenResponse) => {
  if (tokens.access_token) {
    localStorage.setItem(TOKEN_KEY, tokens.access_token);
  }
  // Google only returns a refresh token on the initial consent
  if (tokens.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
  if (tokens.expires_in) {
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString());
  } else {
    localStorage.removeItem(EXPIRES_AT_KEY);
  }
};

const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
};

const requestToken = async (params: URLSearchParams): Promise<Response> => {
  const { clientId, clientSecret, tokenUrl } = getClient();
  params.append("client_id", clientId);
  if (clientSecret) {
    params.append("client_secret", clientSecret);
  }

  return fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
};

let pendingRefresh: Promise<string> | null = null;

/**
 * Exchange the refresh token for a new access token.
 * Returns an empty string when the user has to sign in again.
 */
const refreshAccessToken = (): Promise<string> => {
  // Upload and download can both hit an expired token at once
  if (!pendingRefresh) {
    pendingRefresh = doRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
};

const doRefresh = async (): Promise<string> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    clearTokens();
    return "";
  }

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const response = await requestToken(params);
  if (!response.ok) {
    // 400/401 mean the grant was revoked or expired, so the stored tokens are
    // dead. Anything else may be transient, so keep them and report the error.
    if (response.status === 400 || response.status === 401) {
      clearTokens();
      return "";
    }
    throw new Error(
      await readError(response, `Token refresh failed: ${response.status}`)
    );
  }

  const tokens: TokenResponse = await response.json();
  if (!tokens.access_token) {
    clearTokens();
    return "";
  }
  setTokens(tokens);
  return tokens.access_token;
};

/**
 * Get a usable access token, refreshing it if it is about to expire
 */
const getAccessToken = async (): Promise<string> => {
  const accessToken = localStorage.getItem(TOKEN_KEY);
  if (!accessToken) {
    return "";
  }

  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);
  if (expiresAt && Date.now() > expiresAt - EXPIRY_MARGIN_MS) {
    return refreshAccessToken();
  }
  return accessToken;
};

/**
 * Make an authenticated Drive request, refreshing once on a 401
 */
const driveFetch = async (
  url: string,
  init: RequestInit = {}
): Promise<Response> => {
  const doRequest = (token: string) =>
    application.networkRequest(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await getAccessToken();
  if (!token) {
    throw new Error(NOT_AUTHENTICATED);
  }

  let response = await doRequest(token);
  if (response.status === 401) {
    token = await refreshAccessToken();
    if (!token) {
      throw new Error(NOT_AUTHENTICATED);
    }
    response = await doRequest(token);
  }
  return response;
};

// ============================================
// Drive File Helpers
// ============================================

const getCachedFileId = (name: string) =>
  localStorage.getItem(FILE_ID_KEY_PREFIX + name);

const setCachedFileId = (name: string, id: string) =>
  localStorage.setItem(FILE_ID_KEY_PREFIX + name, id);

const clearCachedFileId = (name: string) =>
  localStorage.removeItem(FILE_ID_KEY_PREFIX + name);

const clearAllCachedFileIds = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(FILE_ID_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
};

/**
 * Find the id of a file in the app data folder.
 * Drive addresses files by id rather than path, so the id is looked up by name
 * once and cached.
 */
const findFileId = async (name: string): Promise<string | null> => {
  const cached = getCachedFileId(name);
  if (cached) {
    return cached;
  }

  const url = new URL(DRIVE_FILES_URL);
  url.searchParams.append("spaces", "appDataFolder");
  url.searchParams.append("q", `name = '${name}' and trashed = false`);
  url.searchParams.append("fields", "files(id)");
  // Oldest first, so devices that each created a copy all settle on the same one
  url.searchParams.append("orderBy", "createdTime");

  const response = await driveFetch(url.toString());
  if (!response.ok) {
    throw new Error(
      await readError(response, `Google Drive lookup failed: ${response.status}`)
    );
  }

  const result: { files?: { id: string }[] } = await response.json();
  const id = result.files?.[0]?.id;
  if (!id) {
    return null;
  }
  setCachedFileId(name, id);
  return id;
};

/**
 * Create a new file in the app data folder and return its id
 */
const createFile = async (name: string, data: Uint8Array): Promise<string> => {
  const boundary = `audiogata-${crypto.randomUUID()}`;
  const metadata = {
    name,
    parents: ["appDataFolder"],
    mimeType: "application/octet-stream",
  };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    data as BlobPart,
    `\r\n--${boundary}--`,
  ]);

  const response = await driveFetch(
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    throw new Error(
      await readError(response, `Google Drive upload failed: ${response.status}`)
    );
  }

  const result: { id: string } = await response.json();
  setCachedFileId(name, result.id);
  return result.id;
};

// ============================================
// Sync Methods (Core functionality)
// ============================================

/**
 * Upload document data to Google Drive
 */
const syncUpload = async (
  request: SyncUploadRequest
): Promise<SyncUploadResponse> => {
  if (!hasLogin()) {
    return {
      success: false,
      error: NOT_AUTHENTICATED,
    };
  }

  try {
    const fileName = getFileName(request.docUrl);
    const binaryData = base64ToUint8Array(request.data);

    const fileId = await findFileId(fileName);
    if (fileId) {
      const response = await driveFetch(
        `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: new Blob([binaryData as BlobPart]),
        }
      );

      if (response.ok) {
        return { success: true };
      }

      // A 404 means the cached file was deleted, so create it again below
      if (response.status !== 404) {
        return {
          success: false,
          error: await readError(
            response,
            `Google Drive upload failed: ${response.status}`
          ),
        };
      }
      clearCachedFileId(fileName);
    }

    await createFile(fileName, binaryData);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
};

/**
 * Download document data from Google Drive
 */
const syncDownload = async (
  request: SyncDownloadRequest
): Promise<SyncDownloadResponse> => {
  if (!hasLogin()) {
    return {
      data: null,
      error: NOT_AUTHENTICATED,
    };
  }

  try {
    const fileName = getFileName(request.docUrl);

    // A second attempt covers a cached id whose file has since been deleted
    for (let attempt = 0; attempt < 2; attempt++) {
      const fileId = await findFileId(fileName);
      if (!fileId) {
        // File doesn't exist yet - this is expected for first sync
        return { data: null };
      }

      const response = await driveFetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`);

      if (response.status === 404) {
        clearCachedFileId(fileName);
        continue;
      }

      if (!response.ok) {
        return {
          data: null,
          error: await readError(
            response,
            `Google Drive download failed: ${response.status}`
          ),
        };
      }

      // Get binary data and convert to Base64
      const arrayBuffer = await response.arrayBuffer();
      return { data: uint8ArrayToBase64(new Uint8Array(arrayBuffer)) };
    }

    return { data: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown download error",
    };
  }
};

// ============================================
// Authentication Methods
// ============================================

/**
 * Initiate OAuth login flow.
 * The host app opens a blank popup and passes its name via request.popupName.
 * Returns the OAuth URL for the host to navigate the popup.
 * The host will relay the callback URL via onLoginCallback.
 */
const login = async (request: LoginRequest): Promise<LoginResponse | void> => {
  if (request.apiKey) {
    localStorage.setItem(CLIENT_ID_KEY, request.apiKey);
  }
  if (request.apiSecret) {
    localStorage.setItem(CLIENT_SECRET_KEY, request.apiSecret);
  }

  if (!request.popupName) {
    return;
  }

  // PKCE isn't used: the token service doesn't forward a code_verifier
  const url = new URL(AUTH_URL);
  url.searchParams.append("client_id", getClient().clientId);
  url.searchParams.append("redirect_uri", getRedirectUri());
  url.searchParams.append("response_type", "code");
  url.searchParams.append("scope", SCOPE);
  // offline + consent makes Google return a refresh token every time
  url.searchParams.append("access_type", "offline");
  url.searchParams.append("prompt", "consent");
  // Lets the Android app route the callback deep link back to this plugin
  url.searchParams.append(
    "state",
    JSON.stringify({ pluginId: await application.getPluginId() })
  );

  return { url: url.toString() };
};

/**
 * Handle the OAuth callback URL relayed by the host.
 * Extracts the authorization code and exchanges it for tokens.
 */
const loginCallback = async (request: LoginCallbackRequest): Promise<void> => {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get("code");
  const error = callbackUrl.searchParams.get("error");

  if (error) {
    application.createNotification({
      message: `Google Drive auth failed: ${callbackUrl.searchParams.get("error_description") || error}`,
      type: "error",
    });
    return;
  }

  if (!code) {
    application.createNotification({
      message: "No authorization code received from Google",
      type: "error",
    });
    return;
  }

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", getRedirectUri());

  const response = await requestToken(params);
  if (!response.ok) {
    const message = await readError(
      response,
      `Token exchange failed: ${response.status}`
    );
    application.createNotification({
      message: `Google Drive auth failed: ${message}`,
      type: "error",
    });
    return;
  }

  const tokens: TokenResponse = await response.json();
  if (tokens.access_token) {
    // A new grant may belong to a different account, so forget old file ids
    clearAllCachedFileIds();
    setTokens(tokens);
    application.createNotification({ message: "Successfully connected to Google Drive!" });
  } else {
    application.createNotification({
      message: "No access token received from Google",
      type: "error",
    });
  }
};

/**
 * Logout and clear all tokens
 */
const logout = async (): Promise<void> => {
  const token =
    localStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  clearTokens();
  clearAllCachedFileIds();

  // Revoking the grant is best effort; the tokens are gone locally either way
  if (token) {
    try {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token }).toString(),
      });
    } catch {
      // Ignore
    }
  }

  application.createNotification({ message: "Disconnected from Google Drive" });
};

/**
 * Check if user is logged in
 */
const isLoggedIn = async (): Promise<boolean> => {
  return hasLogin();
};

// ============================================
// UI Message Handling
// ============================================

/**
 * Send message to UI iframe
 */
const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

/**
 * Get current plugin info for UI
 */
const getInfo = async () => {
  sendMessage({
    type: "info",
    clientId: localStorage.getItem(CLIENT_ID_KEY) || "",
    clientSecret: localStorage.getItem(CLIENT_SECRET_KEY) || "",
    isLoggedIn: hasLogin(),
    redirectUri: getRedirectUri(),
  });
};

/**
 * Handle messages from UI iframe
 */
const handleUiMessage = async (message: UiMessageType) => {
  switch (message.type) {
    case "check-login":
      getInfo();
      break;
    case "save":
      if (message.clientId && message.clientSecret) {
        localStorage.setItem(CLIENT_ID_KEY, message.clientId);
        localStorage.setItem(CLIENT_SECRET_KEY, message.clientSecret);
      } else {
        // Both are needed to use a custom client, so drop back to the default
        localStorage.removeItem(CLIENT_ID_KEY);
        localStorage.removeItem(CLIENT_SECRET_KEY);
      }
      application.createNotification({ message: "Settings saved!" });
      getInfo();
      break;
    case "logout":
      await logout();
      getInfo();
      break;
    default:
      const _exhaustive: never = message;
      break;
  }
};

// ============================================
// Theme Handling
// ============================================

/**
 * Update theme preference
 */
const changeTheme = (theme: Theme) => {
  localStorage.setItem("vite-ui-theme", theme);
};

// ============================================
// Plugin Initialization
// ============================================

/**
 * Initialize plugin on load
 */
const init = async () => {
  // Apply current theme
  const theme = await application.getTheme();
  changeTheme(theme);
};

// ============================================
// Wire up plugin handlers
// ============================================

// Sync methods (core functionality for this plugin)
application.onSyncUpload = syncUpload;
application.onSyncDownload = syncDownload;

// Authentication methods
application.onLogin = login;
application.onLoginCallback = loginCallback;
application.onLogout = logout;
application.onIsLoggedIn = isLoggedIn;

// UI message handling
application.onUiMessage = handleUiMessage;

// Theme handling
application.onChangeTheme = async (theme: Theme) => {
  changeTheme(theme);
};

// Initialize on load
init();
