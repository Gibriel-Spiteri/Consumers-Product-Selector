import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installIssueDiagnostics } from "@/lib/issue-diagnostics";

installIssueDiagnostics();

createRoot(document.getElementById("root")!).render(<App />);
