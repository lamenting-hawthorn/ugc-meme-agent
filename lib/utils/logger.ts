type LogMeta = Record<string, string | number | boolean | undefined>;

function sanitize(meta: LogMeta = {}): LogMeta {
  return Object.fromEntries(
    Object.entries(meta).filter(([key]) => !/key|token|secret|password/i.test(key))
  );
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.info(JSON.stringify({ level: "info", message, ...sanitize(meta) }));
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(JSON.stringify({ level: "warn", message, ...sanitize(meta) }));
  },
  error(message: string, meta?: LogMeta) {
    console.error(JSON.stringify({ level: "error", message, ...sanitize(meta) }));
  }
};
