import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./chat/MessageList.css";
import { App } from "./App.tsx";
import { CardsFixturePage } from "./dev/cards.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// /dev/cards — fixture page for M4 visual gate
const isDevCards = location.pathname === "/dev/cards";

createRoot(root).render(
  <StrictMode>
    {isDevCards ? <CardsFixturePage /> : <App />}
  </StrictMode>,
);
