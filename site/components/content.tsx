import React from "../../vendor/https/dev.jspm.io/react/index.js";
import {SideBar, SideBarLink, SideBarSection} from "./sidebar.tsx";

export const Content: React.FC = ({children}) => (
  <div className="content">
    <SideBar>
      <SideBarSection title={"Get Started"}>
        <SideBarLink href={"/get-started"}>
          Get Started
        </SideBarLink>
        <SideBarLink href={"/get-started#installation"}>
          Installation
        </SideBarLink>
      </SideBarSection>
      <SideBarSection title={"Concept"}>
        <SideBarLink href={"/concept#concept"}>
          Concept
        </SideBarLink>
        <SideBarLink href={"/concept#principals"}>
          Principals
        </SideBarLink>
      </SideBarSection>
      <SideBarSection title={"Features"}>
      </SideBarSection>
    </SideBar>
    {children}
  </div>
);