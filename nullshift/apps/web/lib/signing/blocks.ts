/**
 * The document dialect staff write signable documents in, and the blocks it
 * parses to.
 *
 * Why a dialect and not a rich editor: the document is evidence. What gets
 * hashed and signed must be exactly what was rendered, and a plain-text
 * source that parses deterministically into a small set of blocks gives us
 * that for free — the same blocks render on the signing page, in the email,
 * in the PDF and in the admin preview, and the hash covers the blocks, not a
 * pile of editor markup. It also means a proposal email can be pasted
 * straight in and come out as a structured document.
 *
 * The dialect, line by line:
 *
 *   # Heading            level-1 heading
 *   ## Heading           level-2 heading
 *   - item / * item      bullet list (consecutive lines group)
 *   | a | b | c |        table row; the first row is the header, a row of
 *                        dashes (| --- | --- |) is a separator and is skipped
 *   > text               callout (consecutive lines join)
 *   blank line           ends a paragraph
 *   anything else        paragraph text (consecutive lines join with a space)
 *
 * No inline markup. Bold, links and the like are deliberately absent — a
 * contract that depends on emphasis to be understood is a bad contract, and
 * every renderer would have to agree on the markup for the hash to mean
 * anything.
 *
 * Pure: no I/O.
 */

export type Block =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "callout"; text: string };

const SEPARATOR_CELL = /^:?-{2,}:?$/;

function splitTableRow(line: string): string[] {
  let cells = line.split("|").map((c) => c.trim());
  // A row written as `| a | b |` has an empty first and last cell.
  if (cells.length && cells[0] === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === "") cells = cells.slice(0, -1);
  return cells;
}

const isSeparatorRow = (cells: string[]) =>
  cells.length > 0 && cells.every((c) => SEPARATOR_CELL.test(c));

export function parseDocumentSource(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let para: string[] = [];
  let list: string[] | null = null;
  let table: { header: string[]; rows: string[][] } | null = null;
  let callout: string[] | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "paragraph", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.length) blocks.push({ type: "list", items: list });
    list = null;
  };
  const flushTable = () => {
    if (table && table.header.length) blocks.push({ type: "table", ...table });
    table = null;
  };
  const flushCallout = () => {
    if (callout && callout.length)
      blocks.push({ type: "callout", text: callout.join(" ").trim() });
    callout = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
    flushCallout();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushAll();
      continue;
    }

    const heading = /^(#{1,2})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushAll();
      blocks.push({
        type: "heading",
        level: heading[1].length === 1 ? 1 : 2,
        text: heading[2].trim(),
      });
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushPara();
      flushTable();
      flushCallout();
      (list ??= []).push(bullet[1].trim());
      continue;
    }

    if (trimmed.startsWith("|")) {
      flushPara();
      flushList();
      flushCallout();
      const cells = splitTableRow(trimmed);
      if (isSeparatorRow(cells)) continue;
      if (!table) table = { header: cells, rows: [] };
      else {
        // Ragged rows are padded so every renderer draws the same grid.
        const width = table.header.length;
        const row = cells.slice(0, width);
        while (row.length < width) row.push("");
        table.rows.push(row);
      }
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushPara();
      flushList();
      flushTable();
      (callout ??= []).push(quote[1].trim());
      continue;
    }

    flushList();
    flushTable();
    flushCallout();
    para.push(trimmed);
  }
  flushAll();
  return blocks;
}

/** Plain-text rendering, for the text part of emails and for eyeballing a hash. */
export function blocksToPlainText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push(b.level === 1 ? b.text.toUpperCase() : b.text);
        break;
      case "paragraph":
        out.push(b.text);
        break;
      case "callout":
        out.push(`> ${b.text}`);
        break;
      case "list":
        out.push(b.items.map((i) => `  - ${i}`).join("\n"));
        break;
      case "table":
        out.push(
          [b.header, ...b.rows].map((r) => r.join("  |  ")).join("\n")
        );
        break;
    }
  }
  return out.join("\n\n");
}

/** Is there anything here a person could be asked to sign? */
export function hasSignableContent(blocks: Block[]): boolean {
  return blocks.some(
    (b) =>
      (b.type === "paragraph" && b.text.length > 0) ||
      (b.type === "list" && b.items.length > 0) ||
      (b.type === "table" && b.rows.length > 0) ||
      b.type === "callout"
  );
}

/** Parse something read back from the database into blocks, dropping junk. */
export function blocksFromJson(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const out: Block[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const b = v as Record<string, unknown>;
    switch (b.type) {
      case "heading":
        if (typeof b.text === "string")
          out.push({ type: "heading", level: b.level === 2 ? 2 : 1, text: b.text });
        break;
      case "paragraph":
        if (typeof b.text === "string") out.push({ type: "paragraph", text: b.text });
        break;
      case "callout":
        if (typeof b.text === "string") out.push({ type: "callout", text: b.text });
        break;
      case "list":
        if (Array.isArray(b.items))
          out.push({
            type: "list",
            items: b.items.filter((i): i is string => typeof i === "string"),
          });
        break;
      case "table":
        if (Array.isArray(b.header) && Array.isArray(b.rows))
          out.push({
            type: "table",
            header: b.header.filter((c): c is string => typeof c === "string"),
            rows: b.rows
              .filter((r): r is unknown[] => Array.isArray(r))
              .map((r) => r.map((c) => (typeof c === "string" ? c : String(c ?? "")))),
          });
        break;
    }
  }
  return out;
}
