/**
 * Semantic usage rules for Private Mail icons (documentation for designers/devs).
 *
 * Actions (pair with visible text or aria-label on control):
 * - wallet: fund smart account / add USDC (explorer or copy address)
 * - compose: open new message / compose flow
 * - send: submit message
 * - refresh: reload data (inbox, balance)
 * - close: dismiss dialog/panel
 * - logout: end session
 * - copy: copy address or text to clipboard
 *
 * States (often with tone + label text):
 * - success: completed action
 * - error: failure / validation
 * - warning: cost confirmation, irreversible caution
 * - loading: in-progress (prefer with text or aria-busy on parent)
 *
 * Messaging:
 * - inbox: inbox / mail list context
 * - unread: new message indicator (use with "Unread" label for clarity)
 * - message: single message / thread view
 *
 * Navigation:
 * - chevronLeft: back one step
 *
 * External:
 * - github: link to source repository (pair with visible text or aria-label)
 */

export const ICON_SEMANTICS_DOC = "See iconSemantics.ts header comments." as const;
