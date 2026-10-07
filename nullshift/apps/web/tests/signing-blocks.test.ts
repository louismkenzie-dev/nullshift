import { describe, expect, it } from "vitest";
import {
  blocksFromJson,
  blocksToPlainText,
  hasSignableContent,
  parseDocumentSource,
} from "@/lib/signing/blocks";

/**
 * The document dialect must parse deterministically — the blocks are what is
 * hashed and signed, so two renders of the same source must agree exactly.
 */

describe("parseDocumentSource", () => {
  it("parses headings, paragraphs, lists, tables and callouts", () => {
    const src = `# Title

Hi Ollie,

Thanks for going through it.
These two lines are one paragraph.

## Questions

| # | Question | Answer |
| --- | --- | --- |
| 1 | Flexible numbers | Yes |
| 2 | Split per session | Yes |

- one
* two

> This is an additional build.
> Priced separately.`;
    expect(parseDocumentSource(src)).toEqual([
      { type: "heading", level: 1, text: "Title" },
      { type: "paragraph", text: "Hi Ollie," },
      {
        type: "paragraph",
        text: "Thanks for going through it. These two lines are one paragraph.",
      },
      { type: "heading", level: 2, text: "Questions" },
      {
        type: "table",
        header: ["#", "Question", "Answer"],
        rows: [
          ["1", "Flexible numbers", "Yes"],
          ["2", "Split per session", "Yes"],
        ],
      },
      { type: "list", items: ["one", "two"] },
      { type: "callout", text: "This is an additional build. Priced separately." },
    ]);
  });

  it("is stable under CRLF and trailing whitespace", () => {
    const a = parseDocumentSource("# T\r\n\r\nBody  \r\n");
    const b = parseDocumentSource("# T\n\nBody\n");
    expect(a).toEqual(b);
  });

  it("pads ragged table rows to the header width and drops extras", () => {
    const [table] = parseDocumentSource("| a | b | c |\n| 1 |\n| 1 | 2 | 3 | 4 |");
    expect(table).toEqual({
      type: "table",
      header: ["a", "b", "c"],
      rows: [
        ["1", "", ""],
        ["1", "2", "3"],
      ],
    });
  });

  it("a blank line ends a list, a heading ends a paragraph", () => {
    const blocks = parseDocumentSource("- a\n\n- b\nPara\n# H");
    expect(blocks.map((b) => b.type)).toEqual(["list", "list", "paragraph", "heading"]);
  });

  it("has no inline markup — asterisks inside text are text", () => {
    const [p] = parseDocumentSource("This is **not** bold and [not](a link).");
    expect(p).toEqual({
      type: "paragraph",
      text: "This is **not** bold and [not](a link).",
    });
  });
});

describe("hasSignableContent", () => {
  it("a heading alone is not a document", () => {
    expect(hasSignableContent(parseDocumentSource("# Just a title"))).toBe(false);
    expect(hasSignableContent(parseDocumentSource("# Title\n\nSome terms."))).toBe(true);
    expect(hasSignableContent(parseDocumentSource("| a |\n| --- |"))).toBe(false);
    expect(hasSignableContent(parseDocumentSource("| a |\n| 1 |"))).toBe(true);
  });
});

describe("blocksToPlainText / blocksFromJson", () => {
  it("round-trips through JSON and renders readable text", () => {
    const blocks = parseDocumentSource("# T\n\nHello.\n\n- x\n\n| a | b |\n| 1 | 2 |");
    expect(blocksFromJson(JSON.parse(JSON.stringify(blocks)))).toEqual(blocks);
    expect(blocksToPlainText(blocks)).toBe("T\n\nHello.\n\n  - x\n\na  |  b\n1  |  2");
  });

  it("drops junk it does not recognise", () => {
    expect(blocksFromJson([{ type: "script", text: "x" }, null, 3, { type: "paragraph" }])).toEqual([]);
    expect(blocksFromJson("nope")).toEqual([]);
  });
});
