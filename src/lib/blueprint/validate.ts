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

const validateDesign = load(`${schema.$id}#/$defs/design`);
const validateRecommendation = load(`${schema.$id}#/$defs/recommendation`);
const validateValue = load(`${schema.$id}#/$defs/valueAssessment`);

/** Schema check for one design (also the shape of the guest's takeaway file). */
export function checkDesign(
  input: unknown,
): CheckResult<BlueprintSet["designs"][number]> {
  if (validateDesign(input))
    return { ok: true, value: input as BlueprintSet["designs"][number] };
  return { ok: false, errors: describe(validateDesign) };
}

export function checkRecommendation(
  input: unknown,
): CheckResult<BlueprintSet["recommendation"]> {
  if (validateRecommendation(input))
    return { ok: true, value: input as BlueprintSet["recommendation"] };
  return { ok: false, errors: describe(validateRecommendation) };
}

export function checkValueAssessment(
  input: unknown,
): CheckResult<BlueprintSet["valueAssessment"]> {
  if (validateValue(input))
    return { ok: true, value: input as BlueprintSet["valueAssessment"] };
  return { ok: false, errors: describe(validateValue) };
}
