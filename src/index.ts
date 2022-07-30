import axios from "axios";
import { GetFileType, MessageType, UiMessageType } from "./types";
import "audiogata-plugin-typings";
import { CLIENT_ID, TOKEN_SERVER, TOKEN_URL } from "./shared";

const http = axios.create();

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
      http.defaults.headers.common["Authorization"] = "Bearer " + accessToken;
      return http(originalRequest);
    }
  }
);

const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
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
  if (result.data.access_token && result.data.refresh_token) {
    setTokens(result.data.access_token, result.data.refresh_token);
    return result.data.access_token as string;
  }
};

const loadMethods = () => {
  application.onNowPlayingTracksAdded = save;
  application.onNowPlayingTracksChanged = save;
  application.onNowPlayingTracksRemoved = save;
  application.onNowPlayingTracksSet = save;
};

const removeMethods = () => {
  application.onNowPlayingTracksAdded = undefined;
  application.onNowPlayingTracksChanged = undefined;
  application.onNowPlayingTracksRemoved = undefined;
  application.onNowPlayingTracksSet = undefined;
};

const BASE_URL = "https://www.googleapis.com";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const JSON_MIME_TYPE = "application/json; charset=UTF-8";

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
      loadMethods();
      break;
    case "logout":
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      removeMethods();
      break;
    case "save":
      await save();
      break;
    case "load":
      await load();
      break;
    case "set-keys":
      localStorage.setItem("clientId", message.clientId);
      localStorage.setItem("clientSecret", message.clientSecret);
      application.createNotification({ message: "Api keys Saved!" });
      break;
  }
};

const getFolder = async () => {
  const query = `mimeType = '${FOLDER_MIME_TYPE}' and title = 'audiogata'`;
  const response = await http.get<GetFileType>(
    `${BASE_URL}/drive/v2/files?q=${encodeURIComponent(query)}`
  );
  if (response.data.items.length > 0) {
    return response.data.items[0].id;
  }
  return "";
};

const loadFile = async () => {
  const id = await getFileId();
  if (!id) return;

  const response = await http.get<Track[]>(
    `${BASE_URL}/drive/v2/files/${id}?alt=media`
  );
  await application.setNowPlayingTracks(response.data);
};

const getFileId = async () => {
  const id = await getFolder();
  if (!id) return;

  const query = `'${id}' in parents and title = 'tracks.json'`;
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
    title: "audiogata",
    mimeType: FOLDER_MIME_TYPE,
  });
};

const createFile = async () => {
  let id = await getFolder();
  if (!id) {
    await createFolder();
    id = await getFolder();
  }

  const tracks = await application.getNowPlayingTracks();
  const fileId = await getFileId();
  if (fileId) {
    const response = await http.put(
      BASE_URL + `/upload/drive/v2/files/${fileId}?uploadType=resumable`,
      {
        mimeType: JSON_MIME_TYPE,
      }
    );
    const location = response.headers.location;
    await http.put(location, JSON.stringify(tracks));
  } else {
    const response = await http.post(
      BASE_URL + "/upload/drive/v2/files?uploadType=resumable",
      {
        title: "tracks.json",
        parents: [{ id }],
        mimeType: JSON_MIME_TYPE,
      }
    );
    const location = response.headers.location;
    await http.post(location, JSON.stringify(tracks));
  }
};

const save = async () => {
  await createFile();
};

application.onDeepLinkMessage = async (message: string) => {
  application.postUiMessage({ type: "deeplink", url: message });
};

const load = async () => {
  await loadFile();
};

const init = () => {
  const accessToken = localStorage.getItem("access_token");
  if (accessToken) {
    loadMethods();
  }
};

init();
