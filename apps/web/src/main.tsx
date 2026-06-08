import { render } from "preact";
import { App } from "./app";
import { container } from "./lib/container";
import "./index.css";

// Inicia o motor de sincronização (drena a fila offline quando há rede).
container.sync.start();

const root = document.getElementById("app");
if (root) render(<App />, root);
