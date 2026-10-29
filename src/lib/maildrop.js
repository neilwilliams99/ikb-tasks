// ─── EMAIL DRAG ────────────────────────────────────────────────────────────
// New Outlook and Outlook on the web put a JSON blob on the drag describing
// the dragged rows. The type it goes under is named after how the mail list
// is arranged at that moment, and the names keep multiplying: conversation
// view has given multimaillistconversationrows, message view both maillistrow
// and multimaillistmessagerows. Listing the names we have seen means a list
// in some arrangement we have not drops silently, with no overlay and no
// dialog to explain why, so match the shape of the name instead: an optional
// "multi", "maillist", an optional word for the view, and "row" or "rows".
// Every payload under these names has carried the same fields.
//
// Classic Win32 Outlook instead offers the message as a virtual .msg file,
// which Chromium does not expose to the page at all, so a drag from that
// build arrives with nothing readable and is ignored.
export const MAIL_DRAG_TYPE = /^(multi)?maillist[a-z]*rows?$/;

// `types` is readable during dragenter/dragover, where getData is not.
const dragType = (dt) => Array.from(dt?.types || []).find((t) => MAIL_DRAG_TYPE.test(t)) || null;
export const isMailDrag = (dt) => dragType(dt) !== null;

const EMPTY = { mailbox: null, messages: [] };

// One drag carries every selected message, so this always returns a list.
// `subjects` runs parallel to the id arrays. Some payloads carry itemIds,
// which is the row actually dragged; others only latestItemIds, the newest
// message in that conversation. Prefer the exact one where Outlook gives it.
export function messagesFrom(dt) {
  const type = dragType(dt);
  if (!type) return EMPTY;
  let payload;
  try { payload = JSON.parse(dt.getData(type)); } catch { return EMPTY; }
  if (!Array.isArray(payload?.subjects)) return EMPTY;
  const ids = Array.isArray(payload.itemIds) && payload.itemIds.length ? payload.itemIds
    : Array.isArray(payload.latestItemIds) ? payload.latestItemIds : [];
  return {
    mailbox: payload.mailboxInfos?.[0]?.mailboxSmtpAddress || null,
    messages: payload.subjects.map((s, i) => ({
      subject: (s || "").trim() || "(no subject)",
      itemId: ids[i] || null,
    })),
  };
}

// Opens the one message in Outlook on the web.
//
// Which id arrives depends on where the drag came from, and only one of the
// two survives the email being filed. Decoding them shows why:
//
//   desktop, 68 chars -> 51 bytes:  provider GUID + mailbox GUID + message key
//   browser, 152 chars -> 113 bytes: ... + FOLDER key + mailbox GUID + message key
//
// The browser's id names the folder the message was sitting in, so moving the
// message invalidates it -- four tasks raised from one email that way held
// four different ids, none of which resolved afterwards. The desktop's id
// names only the mailbox and the message, so it keeps working through any
// number of moves. Drag from the desktop.
//
// Linking to a search instead was tried and abandoned: Outlook on the web
// writes ?q= into the address bar when you search but ignores it on a cold
// load, so every such link lands on the mailbox with an empty search box.
export const emailUrl = (itemId) =>
  `https://outlook.office.com/owa/?ItemID=${encodeURIComponent(itemId)}&exvsurl=1&viewmodel=ReadMessageItem`;
