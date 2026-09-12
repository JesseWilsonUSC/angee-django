import * as React from "react";

// TEMPORARY D5 DIAGNOSTIC -- not for merge. Reports whether a state write in an
// effect actually changed anything: the write that logs changed:true on every
// pass of the storm is the one feeding the loop.
export function d5Write<T>(label: string, previous: T, next: T): T {
  if ((import.meta as ImportMeta & { readonly env?: { readonly DEV?: boolean } }).env?.DEV) {
    const changed = !Object.is(previous, next);
    console.count(`[d5w] ${label} changed:${changed}`);
  }
  return next;
}

// Keeps React imported for the type-only surface above without widening the file.
export type D5Unused = React.ReactNode;
