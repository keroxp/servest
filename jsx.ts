// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import React from "./vendor/https/dev.jspm.io/react/index.js";

export type DFC<P = {}> = React.FC<P> & {
  getInitialProps?: () => Promise<P>;
};
