import * as React from "react";
import * as ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const options = {
  unstable_strictMode: false,
};

const root = ReactDOM.createRoot(document.getElementById("root"), options);
root.render(<App />);
