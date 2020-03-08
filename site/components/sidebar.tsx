import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { FC } from "../../types/react/index.d.ts";

export const SideBar: FC = ({ children }) =>
  (
    <div className="sidebar">
      <nav className="sidebarInner">{children}</nav>
    </div>
  );

export const SideBarSection: FC<{
  title?: string;
}> = ({ title, children }) =>
  (
    <div className="sidebarSection">
      {title && <div className="sidebarSectionTitle">{title}</div>}
      <div className="sidebarSectionInner">{children}</div>
    </div>
  );
export const SideBarLink: FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = (
  {
    children,
    ...rest
  }
) =>
  (
    <div className="sidebarLink">
      <a {...rest}>{children}</a>
    </div>
  );
