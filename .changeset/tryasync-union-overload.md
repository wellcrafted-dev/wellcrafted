---
"wellcrafted": patch
---

fix(result): add overload for trySync/tryAsync when catch returns Ok | Err union

Previously, trySync and tryAsync only had overloads for catch handlers that returned exclusively Ok<T> or exclusively Err<E>. This caused type errors when a catch handler could return either based on runtime conditions (conditional recovery pattern).

Added a third overload to both functions that accepts catch handlers returning `Ok<T> | Err<E>`, properly typing the return as `Result<T, E>`.
