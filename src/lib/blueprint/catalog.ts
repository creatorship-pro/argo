import accountingRead from "../../../docs/capabilities/accounting.read.json";
import calendarBook from "../../../docs/capabilities/calendar.book.json";
import crmRead from "../../../docs/capabilities/crm.read.json";
import emailDrafts from "../../../docs/capabilities/email.drafts.json";
import emailSend from "../../../docs/capabilities/email.send.json";
import ledgerTouch from "../../../docs/capabilities/ledger.touch.json";
import type { Capability } from "./types";

/**
 * The capability list the builder may use (ticket B1): the first six entries.
 * A design that needs anything else is flagged "no good fit".
 */
export const CATALOG = [
  accountingRead,
  calendarBook,
  crmRead,
  emailDrafts,
  emailSend,
  ledgerTouch,
] as unknown as Capability[];

/** A capability may be used in a design only once a human has vetted it. */
export function isUsable(
  c: Capability | undefined,
  allowUnvetted: boolean,
): boolean {
  if (!c) return false;
  return c.vetted || (allowUnvetted && c.status !== undefined);
}
