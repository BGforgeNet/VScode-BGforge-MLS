import { getDocumentSettings } from "./server";
import { TextDocument } from "vscode-languageserver-textdocument";

/** Only these languages can be compiled */
const languages = [
    "weidu-tp2",
    "weidu-tp2-tpl",
    "weidu-d",
    "weidu-d-tpl",
    "weidu-baf",
    "weidu-baf-tpl",
    "fallout-ssl",
];
/** These languages require game path to compile */
const languagesRequireGame = ["weidu-d", "weidu-d-tpl", "weidu-baf", "weidu-baf-tpl"];

/** Can we compile this file? */
export async function compileable(document: TextDocument) {
    const langId = document.languageId;
    if (!languages.includes(langId)) {
        return false;
    }
    const settings = await getDocumentSettings(document.uri);
    if (languagesRequireGame.includes(langId) && settings.weidu.gamePath == "") {
        return false;
    }
    return true;
}
