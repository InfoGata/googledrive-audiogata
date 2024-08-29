import axios from "axios";
import { CLIENT_ID, TOKEN_SERVER } from "./shared";
import { MessageType, UiMessageType } from "./types";
import { createEffect, createSignal } from "solid-js";
import { Button } from "./components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion";
import { Input } from "./components/ui/input";

const AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const AUTH_SCOPE = "https://www.googleapis.com/auth/drive.file";
const redirectPath = "/login_popup.html";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token: string;
}

const getToken = async (code: string, redirectUri: string) => {
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("grant_type", "authorization_code");

  const result = await axios.post<TokenResponse>(TOKEN_SERVER, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return result.data;
};

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App = () => {
  const [isLoggedin, setIsLoggedin] = createSignal(false);
  const [pluginId, setPluginId] = createSignal("");
  const [redirectUri, setRedirectUri] = createSignal("");
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [useOwnKeys, setUseOwnKeys] = createSignal(false);
  const [clientId, setClientId] = createSignal("");
  const [clientSecret, setClientSecret] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);

  createEffect(() => {
    const onNewWindowMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "login":
          if (event.data.accessToken) {
            setIsLoggedin(true);
          }
          break;
        case "info":
          setRedirectUri(event.data.origin + redirectPath);
          setPluginId(event.data.pluginId);
          setClientId(event.data.clientId);
          setClientSecret(event.data.clientSecret);
          break;
        default:
          const _exhaustive: never = event.data;
          break;
      }
    };
    window.addEventListener("message", onNewWindowMessage);
    sendUiMessage({ type: "check-login" });
    return () => window.removeEventListener("message", onNewWindowMessage);
  }, []);

  const onLogin = () => {
    const state = { pluginId: pluginId };
    const url = new URL(AUTH_URL);
    if (useOwnKeys()) {
      url.searchParams.append("client_id", clientId());
    } else {
      url.searchParams.append("client_id", CLIENT_ID);
    }
    url.searchParams.append("redirect_uri", redirectUri());
    url.searchParams.append("scope", AUTH_SCOPE);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("state", JSON.stringify(state));
    url.searchParams.append("include_granted_scopes", "true");
    url.searchParams.append("access_type", "offline");
    url.searchParams.append("prompt", "consent");
    console.log(url);

    const newWindow = window.open(url);

    const onMessage = async (returnUrl: string) => {
      const url = new URL(returnUrl);
      const code = url.searchParams.get("code");

      if (code) {
        const response = await getToken(code, redirectUri());
        sendUiMessage({
          type: "login",
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
        });
        setIsLoggedin(true);
      }
      if (newWindow) {
        newWindow.close();
      }
    };

    window.onmessage = (event: MessageEvent) => {
      console.log("why?", event);
      if (event.source === newWindow) {
        onMessage(event.data.url);
      } else {
        if (event.data.type === "deeplink") {
          onMessage(event.data.url);
        }
      }
    };
  };

  const onLogout = () => {
    setIsLoggedin(false);
    sendUiMessage({ type: "logout" });
  };

  const onSaveNowPlaying = () => {
    sendUiMessage({ type: "save-nowplaying" });
  };

  const onLoadNowPlaying = () => {
    sendUiMessage({ type: "load-nowplaying" });
  };

  const onSavePlaylists = () => {
    sendUiMessage({ type: "save-playlists" });
  };

  const onLoadPlaylists = () => {
    sendUiMessage({ type: "load-playlists" });
  };

  const onSavePlugins = () => {
    sendUiMessage({ type: "save-plugins" });
  };

  const onLoadPlugins = () => {
    sendUiMessage({ type: "install-plugins" });
  };

  const onSaveKeys = () => {
    setUseOwnKeys(!!clientId);
    sendUiMessage({
      type: "set-keys",
      clientId: clientId(),
      clientSecret: clientSecret(),
    });
  };

  const onClearKeys = () => {
    setClientId("");
    setClientSecret("");
    setUseOwnKeys(false);
    sendUiMessage({
      type: "set-keys",
      clientId: "",
      clientSecret: "",
    });
  };

  return (
    <div class="flex">
      <div class="flex flex-col gap-2 w-full">
        {isLoggedin() ? (
          <div class="flex flex-col gap-2">
            <div class="flex gap-2">
              <Button onClick={onSaveNowPlaying}>Save Now Playing</Button>
              <Button onClick={onLoadNowPlaying}>Load Now Playing</Button>
            </div>
            <div class="flex gap-2">
              <Button onClick={onSavePlaylists}>Save Playlists</Button>
              <Button onClick={onLoadPlaylists}>Load Playlists</Button>
            </div>
            <div class="flex gap-2">
              <Button onClick={onSavePlugins}>Save Plugins</Button>
              <Button onClick={onLoadPlugins}>Load Plugins</Button>
            </div>
            <div class="flex gap-2">
              <Button onClick={onLogout}>Logout</Button>
            </div>
          </div>
        ) : (
          <div>
            <Button onClick={onLogin}>Login</Button>
            <Accordion multiple collapsible>
              <AccordionItem value="item-1">
                <AccordionTrigger>Advanced Configuration</AccordionTrigger>

                <AccordionContent>
                  <div class="flex flex-col gap-4 m-4">
                    <p>Supplying your own keys:</p>
                    <p>
                      {redirectUri()} needs be added to Authorized Javascript
                      URIs
                    </p>
                    <div>
                      <Input
                        placeholder="Client ID"
                        value={clientId()}
                        onChange={(e) => {
                          const value = e.currentTarget.value;
                          setClientId(value);
                        }}
                      />
                      <Input
                        type="text"
                        placeholder="Client Secret"
                        value={clientSecret()}
                        onChange={(e) => {
                          const value = e.currentTarget.value;
                          setClientSecret(value);
                        }}
                      />
                    </div>
                    <div class="flex gap-2">
                      <Button onClick={onSaveKeys}>Save</Button>
                      <Button onClick={onClearKeys} color="error">
                        Clear
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
