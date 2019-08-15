export async function promiseTimeout(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
