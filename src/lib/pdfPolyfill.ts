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
