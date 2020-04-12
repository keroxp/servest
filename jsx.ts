// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { FC } from "./types/react/index.d.ts";

export type DFC<P = {}> = FC<P> & {
  getInitialProps?: () => Promise<P>;
};
