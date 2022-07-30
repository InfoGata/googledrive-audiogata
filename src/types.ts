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
type UiSaveType = {
  type: "save";
};
type UiLoadType = {
  type: "load";
};

export type UiMessageType =
  | UiCheckLoginType
  | UiLoginType
  | UiLogoutType
  | UiSetKeysType
  | UiLoadType
  | UiSaveType;

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
