import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";

const CLIENT_ID =
  "590824233733-0uk932lnqfed56n5hfgndjhlsmdjga3h.apps.googleusercontent.com";
const AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const AUTH_SCOPE = "https://www.googleapis.com/auth/drive";
const redirectPath = "/login_popup.html";

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
    url.searchParams.append("response_type", "token");
    url.searchParams.append("state", JSON.stringify(state));
    const newWindow = window.open(url);

    const onMessage = (returnUrl: string) => {
      const url = new URL(returnUrl);
      // params are in hash
      url.search = url.hash.substring(1);
      const accessToken = url.searchParams.get("access_token");
      if (accessToken) {
        parent.postMessage({ type: "login", accessToken: accessToken }, "*");
        setAccessToken(accessToken);
      }
      newWindow.close();
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
          <button onClick={onSave}>Save</button>
          <button onClick={onLoad}>Load</button>
          <button onClick={onLogout}>Logout</button>
        </div>
      ) : (
        <button onClick={onLogin}>Login</button>
      )}
    </>
  );
};

export default App;
