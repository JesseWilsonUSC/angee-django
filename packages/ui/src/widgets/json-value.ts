import * as v from "valibot";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

/** Recursive JSON data contract shared by form specs, widgets, and transports. */
export const JsonValueSchema: v.GenericSchema<unknown, JsonValue> = v.lazy(() =>
  v.union([
    v.null(),
    v.string(),
    v.pipe(v.number(), v.finite()),
    v.boolean(),
    v.array(JsonValueSchema),
    v.pipe(
      v.custom<Record<string, unknown>>(isPlainObject),
      v.record(v.string(), JsonValueSchema),
    ),
  ]),
);

/** Validate an optional untyped form value at the shared JSON boundary. */
export function jsonValueFromUnknown(value: unknown): JsonValue | undefined {
  return value === undefined ? undefined : v.parse(JsonValueSchema, value);
}
