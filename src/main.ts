import { createApp } from "vue";

import App from "./App.vue";
import PreviewHost from "./PreviewHost.vue";
import "./style.css";

createApp(window.location.pathname === "/preview" ? PreviewHost : App).mount("#app");
