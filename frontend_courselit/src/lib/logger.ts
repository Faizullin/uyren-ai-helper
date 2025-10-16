export class Log {
  static info(...args: unknown[]) {
    console.log(`[INFO]`, ...args);
  }

  static error(
    message: string,
    metadata?:
      | {
          fileName?: string;
          stack?: Record<string, unknown>;
          [x: string]: any;
        }
      | Error,
    options: {
      errorHandle?: boolean;
    } = {
      errorHandle: true,
    },
  ) {
    if (options?.errorHandle) {
      if (metadata instanceof Error) {
        console.log(`[ERROR]`, message, metadata);
      } else if (typeof metadata === "object") {
        console.log(`[ERROR]`, message, { ...metadata });
      }
    } else {
      console.error(`[ERROR]`, message, metadata);
    }
  }
}
