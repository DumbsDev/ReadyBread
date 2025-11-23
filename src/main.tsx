import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { UserProvider } from "./contexts/UserContext";

const container = document.getElementById("root");
if (!container) throw new Error("Root #root not found");

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>
);
