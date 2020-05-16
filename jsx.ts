// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { FC } from "./types/react/index.d.ts";

export interface DFC<P = {}> extends FC<P> {
  getInitialProps?(): Promise<P>;
}
