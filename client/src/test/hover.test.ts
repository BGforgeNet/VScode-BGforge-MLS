/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

suite("Should get hover", () => {
    const docUri = getDocUri("hover.ssl");

    test("Hover for Fallout SSL", async () => {
        // const mds = [{value: "q"}];
        // const mds = new vscode.MarkdownString("qqq");
        const mds = new vscode.MarkdownString(
            "```fallout-ssl-tooltip\n" +
                "int get_proto_data(int pid, int offset)\n```\n" +
                "Used to read the in-memory copies of the .pro files Fallout makes when they are loaded. " +
                "The offset refers to the offset in memory from the start of the proto to the element you are reading."
        );
        const eh = { contents: [mds] };
        const pos = new vscode.Position(0, 15);
        await testHover(docUri, pos, eh);
    });
});

async function testHover(
    docUri: vscode.Uri,
    position: vscode.Position,
    expectedHover: vscode.Hover
) {
    await activate(docUri);

    const actualHover = (await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        docUri,
        position
    )) as vscode.Hover[];
    const { contents } = actualHover[0];
	// Hover doesn't expose contents properly for some reason
	// Inspired by https://github.com/microsoft/vscode-extension-samples/issues/434
    assert.equal(
        typeof contents[0] === "string" ? contents[0] : contents[0].value,
        typeof expectedHover.contents[0] === "string"
            ? expectedHover.contents[0]
            : expectedHover.contents[0].value
    );
}
