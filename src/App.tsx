import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";

const CLIENT_ID =
  "590824233733-0uk932lnqfed56n5hfgndjhlsmdjga3h.apps.googleusercontent.com";

const BASE_URL = "https://www.googleapis.com";
const AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const AUTH_SCOPE = "https://www.googleapis.com/auth/drive";
const REDIRECT_URI = "http://localhost:3000/audiogata/login_popup.html";

const App: FunctionalComponent = () => {
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onNewWindowMessage = (event: MessageEvent) => {
      switch (event.data.type) {
        case "login":
          if (event.data.accessToken) {
            setAccessToken(event.data.accessToken);
          }
          break;
      }
    };
    window.addEventListener("message", onNewWindowMessage);
    parent.postMessage({ type: "check-login" }, "*");
    return () => window.removeEventListener("message", onNewWindowMessage);
  });

  const onLogin = () => {
    const newWindow = window.open();
    const url = `${AUTH_URL}?redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&client_id=${CLIENT_ID}&scope=${encodeURIComponent(
      AUTH_SCOPE
    )}&response_type=token`;

    window.onmessage = (event: MessageEvent) => {
      if (event.source === newWindow) {
        const url = new URL(event.data.url);
        // params are in hash
        url.search = url.hash.substring(1);
        const accessToken = url.searchParams.get("access_token");
        if (accessToken) {
          parent.postMessage({ type: "login", accessToken: accessToken }, "*");
          setAccessToken(accessToken);
        }
        newWindow.close();
      }
    };
    newWindow.location.href = url;
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
      <pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
    </>
  );
};

export default App;
