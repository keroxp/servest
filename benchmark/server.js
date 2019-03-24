const http = require("http");
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain",
    "Content-Length": "2"
  });
  res.write("ok");
  res.end();
});
server.listen(4500);