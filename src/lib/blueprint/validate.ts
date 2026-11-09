import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import schema from "../../../docs/blueprint/schema.json";
import type { BlueprintSet, Capability } from "./types";

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(schema);

function load(ref: string): ValidateFunction {
  const validate = ajv.getSchema(ref);
  if (!validate) throw new Error(`Blueprint schema is missing ${ref}`);
  return validate;
}

const validateSet = load(schema.$id);
const validateVetted = load(`${schema.$id}#/$defs/vettedCapability`);

export type CheckResult<T> =
  { ok: true; value: T } | { ok: false; errors: string[] };

function describe(validate: ValidateFunction): string[] {
  return (validate.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`,
  );
}

/** Schema check for a whole blueprint set (the format the builder writes). */
export function checkBlueprintSet(input: unknown): CheckResult<BlueprintSet> {
  if (validateSet(input)) return { ok: true, value: input as BlueprintSet };
  return { ok: false, errors: describe(validateSet) };
}

/**
 * Schema check for one B1 capability entry. It only checks the shape: a human
 * still has to review the entry before its status can be `vetted`.
 */
export function checkVettedCapability(input: unknown): CheckResult<Capability> {
  if (validateVetted(input)) return { ok: true, value: input as Capability };
  return { ok: false, errors: describe(validateVetted) };
}
