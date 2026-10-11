/**
 * Compatibility shims for older browsers (notably Safari < 17.4 on iPhone/iPad)
 * that pdfjs-dist v6 requires. Must be imported BEFORE pdfjs-dist so the
 * polyfills exist when the library's module code first runs.
 */

interface PromiseWithResolvers {
  withResolvers<T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
}

const PromiseCtor = Promise as unknown as PromiseWithResolvers;

if (typeof PromiseCtor.withResolvers !== "function") {
  PromiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/**
 * Async iteration over ReadableStream (`for await (const x of stream)`) only
 * exists in Safari 18+. pdfjs uses it in page.getTextContent().
 */
type IterableStreamProto = {
  values?: (options?: { preventCancel?: boolean }) => AsyncIterableIterator<unknown>;
  [Symbol.asyncIterator]?: (options?: { preventCancel?: boolean }) => AsyncIterableIterator<unknown>;
};

if (typeof ReadableStream !== "undefined") {
  const proto = ReadableStream.prototype as unknown as IterableStreamProto;
  if (typeof proto[Symbol.asyncIterator] !== "function") {
    const values = function (
      this: ReadableStream<unknown>,
      options?: { preventCancel?: boolean }
    ): AsyncIterableIterator<unknown> {
      const reader = this.getReader();
      const preventCancel = options?.preventCancel === true;
      const iterator: AsyncIterableIterator<unknown> = {
        async next() {
          try {
            const result = await reader.read();
            if (result.done) reader.releaseLock();
            return result.done
              ? { done: true, value: undefined }
              : { done: false, value: result.value };
          } catch (error) {
            reader.releaseLock();
            throw error;
          }
        },
        async return(value?: unknown) {
          if (!preventCancel) {
            const cancelled = reader.cancel(value);
            reader.releaseLock();
            await cancelled;
          } else {
            reader.releaseLock();
          }
          return { done: true, value };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
      return iterator;
    };
    if (typeof proto.values !== "function") proto.values = values;
    proto[Symbol.asyncIterator] = values;
  }
}

/** Reads a File/Blob to an ArrayBuffer, falling back to FileReader on old Safari. */
export const readFileAsArrayBuffer = (file: Blob): Promise<ArrayBuffer> => {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};
