import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CssBaseline,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import { FunctionalComponent, JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { CLIENT_ID, TOKEN_SERVER } from "./shared";
import { MessageType, UiMessageType } from "./types";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { VisibilityOff, Visibility } from "@mui/icons-material";

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

const App: FunctionalComponent = () => {
  const [isLoggedin, setIsLoggedin] = useState(false);
  const [pluginId, setPluginId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useOwnKeys, setUseOwnKeys] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
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
      }
    };
    window.addEventListener("message", onNewWindowMessage);
    sendUiMessage({ type: "check-login" });
    return () => window.removeEventListener("message", onNewWindowMessage);
  }, []);

  const onLogin = () => {
    const state = { pluginId: pluginId };
    const url = new URL(AUTH_URL);
    if (useOwnKeys) {
      url.searchParams.append("client_id", clientId);
    } else {
      url.searchParams.append("client_id", CLIENT_ID);
    }
    url.searchParams.append("redirect_uri", redirectUri);
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
        const response = await getToken(code, redirectUri);
        sendUiMessage({
          type: "login",
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
        });
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

  const onSave = () => {
    sendUiMessage({ type: "save" });
  };

  const onLoad = () => {
    sendUiMessage({ type: "load" });
  };

  const onSaveKeys = () => {
    setUseOwnKeys(!!clientId);
    sendUiMessage({
      type: "set-keys",
      clientId: clientId,
      clientSecret: clientSecret,
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

  const onAccordionChange = (_: any, expanded: boolean) => {
    setShowAdvanced(expanded);
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event: JSX.TargetedEvent) => {
    event.preventDefault();
  };

  return (
    <Box
      sx={{ display: "flex", "& .MuiTextField-root": { m: 1, width: "25ch" } }}
    >
      <CssBaseline />
      {isLoggedin ? (
        <div>
          <Button variant="contained" onClick={onSave}>
            Save Now Playing
          </Button>
          <Button variant="contained" onClick={onLoad}>
            Load Now Playing
          </Button>
          <Button variant="contained" onClick={onLogout}>
            Logout
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="contained" onClick={onLogin}>
            Login
          </Button>
          <Accordion expanded={showAdvanced} onChange={onAccordionChange}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel1d-content"
              id="panel1d-header"
            >
              <Typography>Advanced Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>Supplying your own keys:</Typography>
              <Typography>
                {redirectUri} needs be added to Authorized Javascript URIs
              </Typography>
              <div>
                <TextField
                  label="Client ID"
                  value={clientId}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setClientId(value);
                  }}
                />
                <TextField
                  type={showPassword ? "text" : "password"}
                  label="Client Secret"
                  value={clientSecret}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setClientSecret(value);
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
              <Stack spacing={2} direction="row">
                <Button variant="contained" onClick={onSaveKeys}>
                  Save
                </Button>
                <Button variant="contained" onClick={onClearKeys} color="error">
                  Clear
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </div>
      )}
    </Box>
  );
};

export default App;
