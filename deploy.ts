import { createDataHolder } from "./data_holder.ts";
import { createResponder } from "./responder.ts";
import { Router } from "./router.ts";
import { ServerRequest, ServerResponse } from "./server.ts";
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { RequestEvent, requestFromEvent, respondToEvent } from "./_adapter.ts";

export function deployer(router: Router): EventListener {
  return (_ev: Event) => {
    // @ts-ignore
    const ev: RequestEvent = _ev;
    const base = requestFromEvent(ev);
    const onResponse = async (resp: ServerResponse) => {
      await respondToEvent(ev, resp);
    };
    const responder = createResponder(onResponse);
    const holder = createDataHolder();
    const dest: Deno.Reader & Deno.Writer = {
      read() {
        throw new Error("unsupported");
      },
      write() {
        throw new Error("unsupported");
      },
    };
    const bufReader = new BufReader(dest);
    const bufWriter = new BufWriter(dest);
    const match = ev.request.url.match(/^\//)!;
    const req: ServerRequest = {
      get conn(): Deno.Conn {
        throw new Error("");
      },
      bufReader,
      bufWriter,
      match,
      ...base,
      ...responder,
      ...holder,
    };
    router.handleRoute("", req);
  };
}
