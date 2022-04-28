import { render } from "preact";
import App from "./App";

export const init = () => {
  render(<App />, document.body);
};
