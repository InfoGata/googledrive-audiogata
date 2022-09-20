export interface GetFileTypeItem {
  id: string;
}

export interface GetFileType {
  items: GetFileTypeItem[];
}

type UiCheckLoginType = {
  type: "check-login";
};
type UiLoginType = {
  type: "login";
  accessToken: string;
  refreshToken: string;
};
type UiLogoutType = {
  type: "logout";
};
type UiSetKeysType = {
  type: "set-keys";
  clientId: string;
  clientSecret: string;
};
type UiSaveNowPlayingType = {
  type: "save-nowplaying";
};
type UiLoadNowPlayingType = {
  type: "load-nowplaying";
};
type UiSavePlaylistsType = {
  type: "save-playlists";
};
type UiLoadPlaylistsType = {
  type: "load-playlists";
};
type UiSavePluginsType = {
  type: "save-plugins";
};
type UiInstallPluginsType = {
  type: "install-plugins";
};

export type UiMessageType =
  | UiCheckLoginType
  | UiLoginType
  | UiLogoutType
  | UiSetKeysType
  | UiSaveNowPlayingType
  | UiLoadNowPlayingType
  | UiSavePlaylistsType
  | UiLoadPlaylistsType
  | UiSavePluginsType
  | UiInstallPluginsType;

type LoginType = {
  type: "login";
  accessToken: string;
};

type InfoType = {
  type: "info";
  origin: string;
  pluginId: string;
  clientId: string;
  clientSecret: string;
};

export type MessageType = LoginType | InfoType;
