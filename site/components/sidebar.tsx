import React from "../../vendor/https/dev.jspm.io/react/index.js";
export const SideBar: React.FC = ({ children }) => (
  <div className="sidebar">{children}</div>
);

export const SideBarSection: React.FC<{
  title?: string;
}> = ({ title, children }) => (
  <div className="sidebarSection">
    {title && <div className="sidebarSectionTitle">{title}</div>}
    <div className="sidebarSectionInner">{children}</div>
  </div>
);
export const SideBarLink: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement>
> = ({ children, ...rest }) => (
  <div className="sidebarLink">
    <a {...rest}>{children}</a>
  </div>
);
