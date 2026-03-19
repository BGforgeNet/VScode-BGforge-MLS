import { describe, expect, it } from "vitest";
import { sortYamlSequenceByPath, sortYamlStanzasAndItems } from "../src/sort-yaml-stanzas-and-items.js";

describe("sortYamlStanzasAndItems", () => {
    it("sorts top-level stanzas alphabetically while preserving stanza formatting", () => {
        const input = `# leading comment

zeta:
  type: 3
  items:
    - name: z

# keep this comment with alpha
alpha:
  type: 14 # keyword
  items:
    - name: "a"

middle:
  doc: |-
    line 1
    line 2
`;

        const result = sortYamlStanzasAndItems(input);

        expect(result).toBe(`# leading comment

# keep this comment with alpha
alpha:
  type: 14 # keyword
  items:
    - name: "a"

middle:
  doc: |-
    line 1
    line 2

zeta:
  type: 3
  items:
    - name: z
`);
    });

    it("sorts items inside stanzas alphabetically while preserving item comments", () => {
        const input = `stanza:
  type: 3
  items:
    # keep this comment with alpha
    - name: zeta
      doc: z

    # keep this comment with beta
    - name: beta
      doc: b

    - name: alpha
      doc: a
`;

        const result = sortYamlStanzasAndItems(input);

        expect(result).toBe(`stanza:
  type: 3
  items:
    - name: alpha
      doc: a

    # keep this comment with beta
    - name: beta
      doc: b

    # keep this comment with alpha
    - name: zeta
      doc: z
`);
    });

    it("sorts a specific nested sequence by key while preserving item comments", () => {
        const input = `repository:
  fallout-base-functions:
    name: support.function.fallout-ssl.base
    patterns:
      - match: \\b(?i)(zeta)\\b

      # keep this comment with deprecated entry
      - match: \\b(?i)(beta)\\b
        name: invalid.deprecated.bgforge

      - match: \\b(?i)(alpha)\\b

other:
  untouched: true
`;

        const result = sortYamlSequenceByPath(input, ["repository", "fallout-base-functions", "patterns"], "match");

        expect(result).toBe(`repository:
  fallout-base-functions:
    name: support.function.fallout-ssl.base
    patterns:
      - match: \\b(?i)(alpha)\\b

      # keep this comment with deprecated entry
      - match: \\b(?i)(beta)\\b
        name: invalid.deprecated.bgforge

      - match: \\b(?i)(zeta)\\b

other:
  untouched: true
`);
    });

    it("sorts a specific nested sequence in compact mode without blank lines between items", () => {
        const input = `repository:
  fallout-base-functions:
    patterns:
      - match: z

      - match: a
`;

        const result = sortYamlSequenceByPath(
            input,
            ["repository", "fallout-base-functions", "patterns"],
            "match",
            { compactItems: true },
        );

        expect(result).toBe(`repository:
  fallout-base-functions:
    patterns:
      - match: a
      - match: z
`);
    });

    it("leaves the file unchanged when the target sequence path is missing", () => {
        const input = `repository:
  fallout-base-functions:
    patterns:
      - match: z
      - match: a
`;

        const result = sortYamlSequenceByPath(input, ["repository", "missing", "patterns"], "match");

        expect(result).toBe(input);
    });
});
