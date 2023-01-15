/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

suite("Should do completion", () => {
    const docUri = getDocUri("completion.ssl");

    test("Completes Fallout SSL", async () => {
        await testCompletion(docUri, new vscode.Position(0, 4), {
            items: [{ label: "get_proto_data", kind: vscode.CompletionItemKind.Function }],
        });
    });
});

async function testCompletion(
    docUri: vscode.Uri,
    position: vscode.Position,
    expectedCompletionList: vscode.CompletionList
) {
    await activate(docUri);

    // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
    const actualCompletionList = (await vscode.commands.executeCommand(
        "vscode.executeCompletionItemProvider",
        docUri,
        position
    )) as vscode.CompletionList;

    assert.ok(actualCompletionList.items.length >= 1);
    expectedCompletionList.items.forEach((expectedItem) => {
        // we always return full list, so...
        const filteredList = actualCompletionList.items.filter((item) => {
            return expectedItem.label == item.label ? true : false;
        });
        const actualItem = filteredList[0];
        assert.equal(actualItem.label, expectedItem.label);
        assert.equal(actualItem.kind, expectedItem.kind);
    });
}
