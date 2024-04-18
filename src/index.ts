import axios from "axios";
import { GetFileType, MessageType, UiMessageType } from "./types";
import { CLIENT_ID, TOKEN_SERVER, TOKEN_URL } from "./shared";

const http = axios.create();

const folderName = "audiogata";
const playlistFileName = "playlists.json";
const pluginsFileName = "plugins.json";
const nowplayingFileName = "nowplaying.json";
const BASE_URL = "https://www.googleapis.com";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const JSON_MIME_TYPE = "application/json; charset=UTF-8";

const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token && config.headers) {
      config.headers["Authorization"] = "Bearer " + token;
    }
    return config;
  },
  (error) => {
    Promise.reject(error);
  }
);

http.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const accessToken = await refreshToken();
      if (accessToken) {
        originalRequest.headers = {
          ...originalRequest.headers,
          authorization: `Bearer ${accessToken}`,
        };
      }
      return http(originalRequest);
    }
  }
);

const setTokens = (accessToken: string, refreshToken?: string) => {
  localStorage.setItem("access_token", accessToken);
  if (refreshToken) {
    localStorage.setItem("refresh_token", refreshToken);
  }
};

const refreshToken = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return;

  const clientId = localStorage.getItem("clientId");
  const clientSecret = localStorage.getItem("clientSecret");
  let tokenUrl = TOKEN_SERVER;

  const params = new URLSearchParams();
  params.append("client_id", clientId || CLIENT_ID);
  params.append("refresh_token", refreshToken);
  params.append("grant_type", "refresh_token");

  if (clientId && clientSecret) {
    params.append("client_secret", clientSecret);
    tokenUrl = TOKEN_URL;
  }
  const result = await axios.post(tokenUrl, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (result.data.access_token) {
    setTokens(result.data.access_token, result.data.refresh_token);
    return result.data.access_token as string;
  }
};

const sendInfo = async () => {
  const host = document.location.host;
  const hostArray = host.split(".");
  hostArray.shift();
  const domain = hostArray.join(".");
  const origin = `${document.location.protocol}//${domain}`;
  const pluginId = await application.getPluginId();
  const clientId = localStorage.getItem("clientId") ?? "";
  const clientSecret = localStorage.getItem("clientSecret") ?? "";
  sendMessage({
    type: "info",
    origin: origin,
    pluginId: pluginId,
    clientId: clientId,
    clientSecret: clientSecret,
  });
};
application.onUiMessage = async (message: UiMessageType) => {
  switch (message.type) {
    case "check-login":
      const accessToken = localStorage.getItem("access_token");
      if (accessToken) {
        sendMessage({ type: "login", accessToken: accessToken });
      }
      await sendInfo();
      break;
    case "login":
      setTokens(message.accessToken, message.refreshToken);
      break;
    case "logout":
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      break;
    case "save-nowplaying":
      await saveNowPlaying();
      break;
    case "load-nowplaying":
      await loadNowplaying();
      break;
    case "save-playlists":
      await savePlaylists();
      application.createNotification({ message: "Playlists Saved!" });
      break;
    case "load-playlists":
      await loadPlaylists();
      application.createNotification({ message: "Playlists Loaded!" });
      break;
    case "save-plugins":
      await savePlugins();
      application.createNotification({ message: "Plugins Saved!" });
      break;
    case "install-plugins":
      installPlugins();
      break;
    case "set-keys":
      localStorage.setItem("clientId", message.clientId);
      localStorage.setItem("clientSecret", message.clientSecret);
      application.createNotification({ message: "Api keys Saved!" });
      break;
    default:
      const _exhaustive: never = message;
      break;
  }
};

const getFolder = async () => {
  const query = `mimeType = '${FOLDER_MIME_TYPE}' and title = '${folderName}'`;
  const response = await http.get<GetFileType>(
    `${BASE_URL}/drive/v2/files?q=${encodeURIComponent(query)}`
  );
  if (response.data.items.length > 0) {
    return response.data.items[0].id;
  }
  return "";
};

const loadFile = async <T>(filename: string) => {
  const id = await getFileId(filename);
  if (!id) return;

  const response = await http.get<T>(
    `${BASE_URL}/drive/v2/files/${id}?alt=media`
  );
  return response.data;
};

const getFileId = async (filename: string) => {
  const id = await getFolder();
  if (!id) return;

  const query = `'${id}' in parents and title = '${filename}'`;
  const response = await http.get<GetFileType>(
    `${BASE_URL}/drive/v2/files?q=${encodeURIComponent(query)}`
  );
  if (response.data.items.length > 0) {
    return response.data.items[0].id;
  }
  return "";
};

const createFolder = async () => {
  await http.post(BASE_URL + "/drive/v2/files", {
    title: folderName,
    mimeType: FOLDER_MIME_TYPE,
  });
};

const createFile = async (filename: string, data: any) => {
  let id = await getFolder();
  if (!id) {
    await createFolder();
    id = await getFolder();
  }

  const fileId = await getFileId(filename);
  if (fileId) {
    const response = await http.put(
      BASE_URL + `/upload/drive/v2/files/${fileId}?uploadType=resumable`,
      {
        mimeType: JSON_MIME_TYPE,
      }
    );
    const location = response.headers.location;
    await http.put(location, JSON.stringify(data));
  } else {
    const response = await http.post(
      BASE_URL + "/upload/drive/v2/files?uploadType=resumable",
      {
        title: filename,
        parents: [{ id }],
        mimeType: JSON_MIME_TYPE,
      }
    );
    const location = response.headers.location;
    await http.post(location, JSON.stringify(data));
  }
};

const saveNowPlaying = async () => {
  const tracks = await application.getNowPlayingTracks();
  await createFile(nowplayingFileName, tracks);
};

const loadNowplaying = async () => {
  const data = await loadFile<Track[]>(nowplayingFileName);
  if (data) {
    await application.setNowPlayingTracks(data);
  }
};

const savePlaylists = async () => {
  const playlists = await application.getPlaylists();
  await createFile(playlistFileName, playlists);
};

const loadPlaylists = async () => {
  const data = await loadFile<Playlist[]>(playlistFileName);
  if (data) {
    await application.addPlaylists(data);
  }
};

const savePlugins = async () => {
  const plugins = await application.getPlugins();
  await createFile(pluginsFileName, plugins);
};

const installPlugins = async () => {
  const data = await loadFile<PluginInfo[]>(pluginsFileName);
  if (data) {
    await application.installPlugins(data);
  }
};

application.onDeepLinkMessage = async (message: string) => {
  application.postUiMessage({ type: "deeplink", url: message });
};

const changeTheme = (theme: Theme) => {
  localStorage.setItem("kb-color-mode", theme);
};
application.onChangeTheme = async (theme: Theme) => {
  changeTheme(theme);
};

const init = async () => {
  const theme = await application.getTheme();
  changeTheme(theme);
};

init();
