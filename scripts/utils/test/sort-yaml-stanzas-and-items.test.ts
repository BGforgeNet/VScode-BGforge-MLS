import { describe, expect, it } from "vitest";
import { sortYamlStanzasAndItems } from "../src/sort-yaml-stanzas-and-items.js";

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
});
