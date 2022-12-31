import { getDocumentSettings } from "./server";
import { TextDocument } from "vscode-languageserver-textdocument";

/** Only these languages can be compiled */
const compile_languages = [
    "weidu-tp2",
    "weidu-tp2-tpl",
    "weidu-d",
    "weidu-d-tpl",
    "weidu-baf",
    "weidu-baf-tpl",
    "fallout-ssl",
];
/** These languages require game path to compile */
const compile_languages_with_game = ["weidu-d", "weidu-d-tpl", "weidu-baf", "weidu-baf-tpl"];

/** Can we compile this file? */
export async function compileable(document: TextDocument) {
    const lang_id = document.languageId;
    if (!compile_languages.includes(lang_id)) {
        return false;
    }
    const settings = await getDocumentSettings(document.uri);
    if (compile_languages_with_game.includes(lang_id) && settings.weidu.gamePath == "") {
        return false;
    }
    return true;
}
