import { createRoot } from "react-dom/client";
import Dashboard from "./pages/Dashboard.jsx";
import "./reports-embed.css";

const roots = new WeakMap();

function mount(container, extraConfig) {
    container = container || document.getElementById("a2z-reports-root");

    if (!(container instanceof Element)) {
        throw new TypeError("Reports: a valid DOM element is required.");
    }

    if (roots.has(container)) {
        return roots.get(container);
    }

    const config = {
        height: container.dataset.height || "",
        ...(extraConfig || {}),
    };

    container.textContent = "";
    container.classList.add("a2z-reports", "analytics-dashboard-embed");

    if (config.height) {
        container.style.height = config.height;
    }

    const root = createRoot(container);
    roots.set(container, root);
    root.render(<Dashboard />);

    return root;
}

function unmount(container) {
    container = container || document.getElementById("a2z-reports-root");

    const root = container && roots.get(container);

    if (!root) {
        return;
    }

    root.unmount();
    roots.delete(container);
}

function open(config) {
    return mount(null, config);
}

const close = unmount;

window.ReportDashboard = { mount, unmount };

export { mount, unmount, open, close };
