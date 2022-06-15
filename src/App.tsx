import { Button } from "@mui/material";
import axios from "axios";
import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";
import { CLIENT_ID, TOKEN_SERVER } from "./shared";

const AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const AUTH_SCOPE = "https://www.googleapis.com/auth/drive";
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
  console.log(result);
  return result.data;
};

const App: FunctionalComponent = () => {
  const [accessToken, setAccessToken] = useState("");
  const [pluginId, setPluginId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    const onNewWindowMessage = (event: MessageEvent) => {
      switch (event.data.type) {
        case "login":
          if (event.data.accessToken) {
            setAccessToken(event.data.accessToken);
          }
        case "origin":
          setRedirectUri(event.data.origin + redirectPath);
          setPluginId(event.data.pluginId);
          break;
      }
    };
    window.addEventListener("message", onNewWindowMessage);
    parent.postMessage({ type: "check-login" }, "*");
    return () => window.removeEventListener("message", onNewWindowMessage);
  }, []);

  const onLogin = () => {
    const state = { pluginId: pluginId };
    const url = new URL(AUTH_URL);
    url.searchParams.append("client_id", CLIENT_ID);
    url.searchParams.append("redirect_uri", redirectUri);
    url.searchParams.append("scope", AUTH_SCOPE);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("state", JSON.stringify(state));
    url.searchParams.append("include_granted_scopes", "true");
    url.searchParams.append("access_type", "offline");
    url.searchParams.append("prompt", "consent");

    const newWindow = window.open(url);

    const onMessage = async (returnUrl: string) => {
      const url = new URL(returnUrl);
      const code = url.searchParams.get("code");

      if (code) {
        const response = await getToken(code, redirectUri);
        parent.postMessage(
          {
            type: "login",
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
          },
          "*"
        );
      }
      if (newWindow) {
        newWindow.close();
      }
    };

    window.onmessage = (event: MessageEvent) => {
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
    setAccessToken("");
    parent.postMessage({ type: "logout" }, "*");
  };

  const onSave = () => {
    parent.postMessage({ type: "save" }, "*");
  };

  const onLoad = () => {
    parent.postMessage({ type: "load" }, "*");
  };

  return (
    <>
      {accessToken ? (
        <div>
          <Button variant="contained" onClick={onSave}>
            Save
          </Button>
          <Button variant="contained" onClick={onLoad}>
            Load
          </Button>
          <Button variant="contained" onClick={onLogout}>
            Logout
          </Button>
        </div>
      ) : (
        <Button variant="contained" onClick={onLogin}>
          Login
        </Button>
      )}
    </>
  );
};

export default App;
