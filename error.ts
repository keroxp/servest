export class RoutingError extends Error {
  constructor(readonly status: number, readonly msg: string) {
    super(msg);
  }
}
