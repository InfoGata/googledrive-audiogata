import { useState, useEffect } from "preact/hooks";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { MessageType, UiMessageType } from "./shared";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "info":
          setClientId(event.data.clientId);
          setClientSecret(event.data.clientSecret);
          setRedirectUri(event.data.redirectUri);
          setIsLoggedIn(event.data.isLoggedIn);
          break;
      }
    };

    window.addEventListener("message", onMessage);
    sendUiMessage({ type: "check-login" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const saveCredentials = () => {
    sendUiMessage({
      type: "save",
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
  };

  const handleLogout = () => {
    sendUiMessage({ type: "logout" });
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-md">
      <h1 className="text-xl font-bold">Google Drive Sync Plugin Settings</h1>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Status:{" "}
          {isLoggedIn ? (
            <span className="text-green-600 font-medium">Connected to Google Drive</span>
          ) : (
            <span className="text-yellow-600 font-medium">Not Connected</span>
          )}
        </p>
      </div>

      {isLoggedIn ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Your AudioGata playlists and favorites are being synced to a hidden
            app folder in your Google Drive.
          </p>
          <Button variant="destructive" onClick={handleLogout}>
            Disconnect from Google Drive
          </Button>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
            <p>
              No setup is needed. Go to AudioGata Settings → Cloud Sync, choose
              this plugin and log in with your Google account.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Use Your Own Google OAuth Client (Optional)</h2>
            <p className="text-sm text-muted-foreground">
              Both the Client ID and Client Secret are required. Leave them empty
              to use the default client.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Client ID</label>
            <Input
              placeholder="Your Google Client ID"
              value={clientId}
              onChange={(e: any) => {
                const value = (e.target as HTMLInputElement).value;
                setClientId(value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Client Secret</label>
            <Input
              type="password"
              placeholder="Your Google Client Secret"
              value={clientSecret}
              onChange={(e: any) => {
                const value = (e.target as HTMLInputElement).value;
                setClientSecret(value);
              }}
            />
          </div>

          <Button onClick={saveCredentials}>Save</Button>

          <div className="text-sm text-muted-foreground mt-4">
            <h3 className="font-medium mb-2">Setup Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to the{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>{" "}
                and create or select a project
              </li>
              <li>Enable the Google Drive API for the project</li>
              <li>
                On the OAuth consent screen, add the scope{" "}
                <code className="bg-muted px-1 rounded">
                  https://www.googleapis.com/auth/drive.appdata
                </code>
              </li>
              <li>Create an OAuth client ID of type "Web application"</li>
              <li>
                Add this Authorized redirect URI:{" "}
                <code className="bg-muted px-1 rounded break-all">{redirectUri}</code>
              </li>
              <li>Copy the Client ID and Client Secret, paste them above and click Save</li>
              <li>Go to AudioGata Settings → Cloud Sync to connect</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
