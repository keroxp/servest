import React from "https://dev.jspm.io/react"
import ReactDOMServer from "https://dev.jspm.io/react-dom/server"
import { createRouter } from "https://denopkg.com/keroxp/servest/router.ts";

const View = ({title, children}: {title: string, children?: any[]}) => (
  <html>
  <head>
    <title>{title}</title>
  </head>
  <body>
  {children}
  </body>
  </html>
);

const router = createRouter();
router.handle("/", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/html; charset=UTF-8"
    }),
    body: ReactDOMServer.renderToString(
      <View title={"servest"}>
        Hello Servest!
      </View>
    )
  });
});
router.listen(":8899");
