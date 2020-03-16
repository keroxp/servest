import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { SideBar, SideBarLink, SideBarSection } from "./sidebar.tsx";
import { FC } from "../../types/react/index.d.ts";

export const Content: FC = ({ children }) =>
  (
    <div className="content">
      <SideBar>
        <SideBarSection title={"Get Started"}>
          <SideBarLink href={"/get-started"}>Get Started</SideBarLink>
          <SideBarLink href={"/installation"}>Installation</SideBarLink>
        </SideBarSection>
        <SideBarSection title={"API"}>
          <SideBarLink href={"/app-api"}>App API</SideBarLink>
          <SideBarLink href={"/server-api"}>Server APi</SideBarLink>
          <SideBarLink href={"/agent-api"}>Agent API</SideBarLink>
        </SideBarSection>
        <SideBarSection title={"Concept"}>
          <SideBarLink href={"/concept"}>Concept</SideBarLink>
        </SideBarSection>
        <SideBarSection title={"Features"}>
          <SideBarLink href={"/reading-body"}>Reading body</SideBarLink>
          <SideBarLink href={"/use-middleware"}>Use middleware</SideBarLink>
          <SideBarLink href={"/use-router"}>Use Router</SideBarLink>
          <SideBarLink href={"/use-jsx"}>Use JSX</SideBarLink>
          <SideBarLink href={"/handle-errors"}>Handle errors</SideBarLink>
          <SideBarLink href={"/use-serve-static"}>
            Serve static files
          </SideBarLink>
          <SideBarLink href={"/use-serve-jsx"}>
            Serve JSX files as a page
          </SideBarLink>
          <SideBarLink href={"/testing-handler"}>Testing Handler</SideBarLink>
          <SideBarLink href={"/manage-cookie"}>Manage Cookie</SideBarLink>
          <SideBarLink href={"/handle-ws"}>Handle WebSocket</SideBarLink>
          <SideBarLink href={"/basic-auth"}>Basic Auth</SideBarLink>
        </SideBarSection>
      </SideBar>
      {children}
    </div>
  );
