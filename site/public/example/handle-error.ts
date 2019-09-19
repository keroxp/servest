router.handleError(async (e, req) => {
  await req.respond({
    status: 500,
    body: new TextEncoder().encode("Internal Server Error")
  });
});
