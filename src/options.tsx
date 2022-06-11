import { createTheme, ThemeProvider } from "@mui/material";
import { render } from "preact";
import App from "./App";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

export const init = () => {
  render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
    document.body
  );
};
