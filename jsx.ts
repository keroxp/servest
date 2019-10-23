import React from "./vendor/https/dev.jspm.io/react/index.js";

export type DFC<P = {}> = React.FC<P> & {
  getInitialProps?: () => Promise<P>;
};
