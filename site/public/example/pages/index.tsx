import React from "https://dev.jspm.io/react/index.js";
import { DFC } from "https://servestjs.org/@/serve_jsx.ts";

const Index: DFC<{ title: string; text: string }> = ({ title, text }) => {
  return (
    <html>
      <head>
        <meta charSet={"UTF-8"} />
        <title>{title}</title>
      </head>
      <body>
        <div>{text}</div>
      </body>
    </html>
  );
};

// getInitialProps is an asynchronous data fetcher
// for rendering components in server side.
// This is identical methodology to Next.js
// It will be called exactly once for each request.
Index.getInitialProps = async () => {
  const resp = await fetch("https://some-api.com");
  const text = await resp.text();
  return { title: "Index Page", text };
};

// default export are used for Server Side Rendering.
export default Index;
