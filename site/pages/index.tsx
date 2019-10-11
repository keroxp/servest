import { React } from "../react.ts";
import { Code, CodeState } from "../components/code.tsx";
import { loadContents } from "../content.ts";

function Index({ codes }: { codes: CodeState[] }) {
  return (
    <>
      <div className="root">
        <div className="content">
          <div className="sidebar">
            <div className="heading">
              <h1>Servest</h1>
              <p>A progressive http server for Deno</p>
            </div>
            <hr />
            <div className="sidebarSection">Examples</div>
            {codes.map(({ id, title }) => (
              <div className="sidebarLink">
                <a href={"#" + id}>{title}</a>
              </div>
            ))}
            <hr />
            <div className="sidebarLink">
              <a href="https://github.com/keroxp/servest" target="_blank">
                Github
              </a>
            </div>
          </div>
          <div className="article">
            {codes.map(v => (
              <Code {...v} />
            ))}
          </div>
        </div>
        <div className="footer">
          (c) 2019 Yusuke Sakurai, MIT License, Powered by{" "}
          <a href="/">Servest</a>
        </div>
      </div>
    </>
  );
}

Index.getInitialProps = async () => {
  const codes = await loadContents();
  return { codes };
};

export default Index;
