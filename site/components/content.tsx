import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { SideBar, SideBarLink, SideBarSection } from "./sidebar.tsx";

export const Content: React.FC = ({ children }) => (
  <div className="content">
    <SideBar>
      <SideBarSection title={"Get Started"}>
        <SideBarLink href={"/get-started"}>Get Started</SideBarLink>
        <SideBarLink href={"/installation"}>Installation</SideBarLink>
      </SideBarSection>
      <SideBarSection title={"API"}>
        <SideBarLink href={"/router-api"}>Router API</SideBarLink>
        <SideBarLink href={"/server-api"}>Server API</SideBarLink>
        <SideBarLink href={"/agent-api"}>Agent API</SideBarLink>
      </SideBarSection>
      <SideBarSection title={"Concept"}>
        <SideBarLink href={"/concept"}>Concept</SideBarLink>
      </SideBarSection>
      <SideBarSection title={"Features"}>
        <SideBarLink href={"/reading-body"}>Reading body</SideBarLink>
        <SideBarLink href={"/use-middleware"}>Use middleware</SideBarLink>
        <SideBarLink href={"/use-jsx"}>Use JSX</SideBarLink>
        <SideBarLink href={"/use-serve-static"}>Serve static files</SideBarLink>
        <SideBarLink href={"/use-serve-jsx"}>
          Serve JSX files as a page
        </SideBarLink>
      </SideBarSection>
    </SideBar>
    {children}
  </div>
);
