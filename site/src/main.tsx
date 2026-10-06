import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./fonts";
import "./site.css";

// The HTML is prerendered; React only takes over for the copy buttons.
const root = document.getElementById("root");
if (root) hydrateRoot(root, <App />);
