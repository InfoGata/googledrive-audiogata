import axios, { AxiosRequestConfig } from "axios";
import { Application, GetFileType, ISong } from "./types";

declare const application: Application;

const BASE_URL = "https://www.googleapis.com";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const JSON_MIME_TYPE = "application/json; charset=UTF-8";

let accessToken: string = "";

const sendOrigin = async () => {
  const host = document.location.host;
  const hostArray = host.split(".");
  hostArray.shift();
  const domain = hostArray.join(".");
  const origin = `${document.location.protocol}//${domain}`;
  const pluginId = await application.getPluginId();
  application.postUiMessage({
    type: "origin",
    origin: origin,
    pluginId: pluginId,
  });
};
application.onUiMessage = async (message: any) => {
  switch (message.type) {
    case "check-login":
      accessToken = localStorage.getItem("access_token");
      if (accessToken) {
        application.postUiMessage({ type: "login", accessToken: accessToken });
      }
      await sendOrigin();
      break;
    case "login":
      accessToken = message.accessToken;
      localStorage.setItem("access_token", accessToken);
      break;
    case "logout":
      localStorage.removeItem("access_token");
      accessToken = null;
      break;
    case "save":
      await save();
      break;
    case "load":
      await load();
      break;
  }
};

const getRequestConfig = () => {
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  return config;
};

const getFolder = async () => {
  const query = `mimeType = '${FOLDER_MIME_TYPE}' and title = 'audiogata'`;
  const response = await axios.get<GetFileType>(
    `${BASE_URL}/drive/v2/files?q=${encodeURIComponent(query)}`,
    getRequestConfig()
  );
  if (response.data.items.length > 0) {
    return response.data.items[0].id;
  }
  return "";
};

const loadFile = async () => {
  const id = await getFileId();
  if (!id) return;

  const response = await axios.get<ISong[]>(
    `${BASE_URL}/drive/v2/files/${id}?alt=media`,
    getRequestConfig()
  );
  await application.setNowPlayingTracks(response.data);
};

const getFileId = async () => {
  const id = await getFolder();
  if (!id) return;

  const query = `'${id}' in parents and title = 'tracks.json'`;
  const response = await axios.get<GetFileType>(
    `${BASE_URL}/drive/v2/files?q=${encodeURIComponent(query)}`,
    getRequestConfig()
  );
  if (response.data.items.length > 0) {
    return response.data.items[0].id;
  }
  return "";
};

const createFolder = async () => {
  await axios.post(
    BASE_URL + "/drive/v2/files",
    {
      title: "audiogata",
      mimeType: FOLDER_MIME_TYPE,
    },
    getRequestConfig()
  );
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
    const response = await axios.put(
      BASE_URL + `/upload/drive/v2/files/${fileId}?uploadType=resumable`,
      {
        mimeType: JSON_MIME_TYPE,
      },
      getRequestConfig()
    );
    const location = response.headers.location;
    await axios.put(location, JSON.stringify(tracks), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } else {
    const response = await axios.post(
      BASE_URL + "/upload/drive/v2/files?uploadType=resumable",
      {
        title: "tracks.json",
        parents: [{ id }],
        mimeType: JSON_MIME_TYPE,
      },
      getRequestConfig()
    );
    const location = response.headers.location;
    await axios.post(location, JSON.stringify(tracks), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
};

const save = async () => {
  await createFile();
};

application.onNowPlayingTracksAdded = save;
application.onNowPlayingTracksChanged = save;
application.onNowPlayingTracksRemoved = save;
application.onNowPlayingTracksSet = save;

application.onDeepLinkMessage = async (message: string) => {
  application.postUiMessage({ type: "deeplink", url: message });
};

const load = async () => {
  await loadFile();
};

const init = () => {
  accessToken = localStorage.getItem("access_token");
};

init();
