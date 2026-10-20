---
"wellcrafted": minor
---

Contain `wellcrafted/logger` sink failures and require sinks to receive events synchronously.

**Breaking change.** `LogSink` callbacks now return `undefined` instead of `void`. Async receivers, and receivers that return a promise or any other value, no longer typecheck. The logger never awaited them, so a rejected promise from a sink went unhandled; the type now matches what the logger does at runtime.

What changed:

- `createLogger` delivers through the same guard as `composeSinks`. When a sink throws synchronously, the logger reports the thrown value and the original event with `console.error` and returns normally. A sink failure no longer escapes `log.warn(...)` or replaces the Result passing through `tapErr(log.warn)`.
- `composeSinks` attempts every member in order. A throwing member no longer stops later members from receiving the event. The emergency console report is best-effort; if it throws, that is swallowed too.
- `consoleSink` renders `trace` events with `console.debug`, so trace output no longer includes a stack trace.
- The documented console stream routing is corrected: in Bun and Node, `info`, `debug`, and `trace` write to stdout, and `warn` and `error` write to stderr. Console output is human-readable text, not JSON Lines.

Block-bodied callbacks typed as `LogSink` keep working. Migration is needed for async receivers, expression bodies that return a value, and functions declared with an explicit `void` return type:

```diff
-const remoteSink: LogSink = async (event) => {
-  await fetch("/api/logs", { method: "POST", body: JSON.stringify(event) });
-};
+const remoteSink: LogSink = (event) => {
+  void fetch("/api/logs", { method: "POST", body: JSON.stringify(event) }).catch(
+    (cause) => console.error("Log upload failed", cause),
+  );
+};

-const recentSink: LogSink = (event) => recent.push(event);
+const recentSink: LogSink = (event) => {
+  recent.push(event);
+};

-function forward(event: LogEvent): void {
+function forward(event: LogEvent): undefined {
   recent.push(event);
 }
```

A sink that starts background work owns that work's completion and failures. The logger attempts receipt synchronously and does not guarantee that an event reaches durable storage.
