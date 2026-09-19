import { packageName as agent } from "@slidesend/agent";
import { packageName as aws } from "@slidesend/aws";
import { packageName as basics } from "@slidesend/basics";
import { packageName as core } from "@slidesend/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <h1>How does gravity work?</h1>
    <ul aria-label="Slidesend packages">
      {[core, basics, aws, agent].map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  </StrictMode>,
);
