import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { SideBar, SideBarLink, SideBarSection } from "./sidebar.tsx";
import { FC } from "../../types/react/index.d.ts";

export const Links = {
  getStarted: [
    ["/get-started", "Get Started"],
    ["/installation", "Installation"],
  ],
  api: [
    ["/app-api", "App API"],
    ["/server-api", "Server API"],
    ["/agent-api", "Agent API"],
  ],
  features: [
    ["/reading-body", "Reading body"],
    ["/use-middleware", "Use middleware"],
    ["/use-router", "Use Router"],
    ["/use-jsx", "Use JSX"],
    ["/handle-errors", "Handle errors"],
    ["/use-serve-static", "Serve static files"],
    ["/use-serve-jsx", "Serve JSX files as a page"],
    ["/testing-handler", "Testing Handler"],
    ["/manage-cookie", "Manage Cookie"],
    ["/handle-ws", "Handle WebSocket"],
    ["/basic-auth", "Basic Auth"],
  ],
};

export const Content: FC = ({ children }) => (
  <div className="content">
    <SideBar>
      <SideBarSection title={"Get Started"}>
        {Links.getStarted.map(([href, text]) => (
          <SideBarLink href={href}>{text}</SideBarLink>
        ))}
      </SideBarSection>
      <SideBarSection title={"API"}>
        {Links.api.map(([href, text]) => (
          <SideBarLink href={href}>{text}</SideBarLink>
        ))}
      </SideBarSection>
      <SideBarSection title={"Concept"}>
        <SideBarLink href={"/concept"}>Concept</SideBarLink>
      </SideBarSection>
      <SideBarSection title={"Features"}>
        {Links.features.map(([href, text]) => (
          <SideBarLink href={href}>{text}</SideBarLink>
        ))}
      </SideBarSection>
    </SideBar>
    {children}
  </div>
);
