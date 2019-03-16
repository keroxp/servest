export async function wait<T>(msec: number, res?: T): Promise<T> {
  return new Promise<T>(resolve => {
    setTimeout(() => resolve(res), msec)
  })
}
