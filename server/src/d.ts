import { CharStreams, CommonTokenStream, ParserRuleContext } from "antlr4ts";
import { DLexer } from "./dparser/DLexer";
import { AppendDActionContext, BeginDActionContext, DParser, ExternTransitionTargetContext, GotoTransitionTargetContext, IfThenStateContext, ReplaceDActionContext, StringRuleContext } from "./dparser/DParser";
import { DParserVisitor } from "./dparser/DParserVisitor";
import { AbstractParseTreeVisitor, ErrorNode, ParseTree, RuleNode } from "antlr4ts/tree"
import { HeaderData } from "./language";
import { Location, Position } from "vscode-languageserver";


export function loadFileData(uri: string, str: string): HeaderData {
    const definedStates = collectStatesFromFile(str);
    const definitions: [string, Location][] = definedStates.map(s => [`${s.dlg}@${s.label}`, {
        range: {
            start: {
                line: s.line,
                character: s.start
            },
            end: {
                line: s.line,
                character: s.end
            },
        },
        uri: uri
    }])
    return {
        definition: new Map(definitions),
        hover: new Map(),
        completion: []
    }
}

function collectStatesFromFile(str: string) {
    const parseTree = parseSilently(str);
    const statesCollector = new StateDefinitionCollector();
    const collectedStates = parseTree.accept(statesCollector);
    return collectedStates;
}

export function findSymbolAtPosition(str: string, pos: Position): string {
    const allSymbols = parseSilently(str).accept(new SymbolCollector())
    const foundSymbol = allSymbols.find(s => {
        return s.location.range.start.line <= pos.line && s.location.range.end.line >= pos.line
            && s.location.range.start.character <= pos.character && s.location.range.end.character >= pos.character
    })
    return foundSymbol?.id || ""
}

function parseSilently(str: string) {
    const charStream = CharStreams.fromString(str);
    const lexer = new DLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new DParser(tokenStream);
    parser.removeErrorListeners();
    return parser.dFileRule();
}

function cleanString(str: string) {
    if (str.startsWith('~~~~~')) {
        return str.substring(5, str.length - 5);
    } else if (str.length > 0 && str[0] == '~' || str[0] == "\"" || str[0] == '%') {
        return str.substring(1, str.length - 1)
    } else {
        return str
    }
}


abstract class DlgAwareErroResistantVisitor<T> extends AbstractParseTreeVisitor<T> implements DParserVisitor<T> {
    dlgStack: string[] = [];

    protected visitChildrenWithUpdatedDlg(dlg: string, ctx: RuleNode): T {
        this.dlgStack.push(dlg);
        const res = this.visitChildren(ctx);
        this.dlgStack.pop();
        return res;
    }

    get currentDlg() {
        return this.dlgStack.at(-1)
    }

    visitChildren(node: RuleNode): T {
        for (let i = node.childCount; i < node.childCount; i++) {
            if (node instanceof ErrorNode) {
                return this.defaultResult();
            }
        }
        return super.visitChildren(node);
    }

    visitBeginDAction?: ((ctx: BeginDActionContext) => T) = ctx => this.visitChildrenWithUpdatedDlg(cleanString(ctx._dlg.text), ctx);

    visitAppendDAction?: ((ctx: AppendDActionContext) => T) = ctx => this.visitChildrenWithUpdatedDlg(cleanString(ctx._dlg.text), ctx);

    visitReplaceDAction?: ((ctx: ReplaceDActionContext) => T) = ctx => this.visitChildrenWithUpdatedDlg(cleanString(ctx._dlg.text), ctx);
}


interface Symbol {
    id: string,
    location: Omit<Location, 'uri'>
}


class SymbolCollector extends DlgAwareErroResistantVisitor<Symbol[]> {
    dlgStack: string[] = [];

    protected defaultResult(): Symbol[] {
        return [];
    }

    protected aggregateResult(aggregate: Symbol[], nextResult: Symbol[]): Symbol[] {
        return aggregate.concat(nextResult)
    }


    visitExternTransitionTarget?: ((ctx: ExternTransitionTargetContext) => Symbol[]) = ctx => {
        return [{
            id: `${cleanString(ctx._dlg.text)}@${cleanString(ctx._label.text)}`,
            location: makePartialLocationFromParseTree(ctx)
        }]
    }

    visitGotoTransitionTarget?: ((ctx: GotoTransitionTargetContext) => Symbol[]) = ctx => {
        return [{
            id: `${this.currentDlg!}@${cleanString(ctx._label.text)}`,
            location: makePartialLocationFromParseTree(ctx)
        }]
    }
}

interface LocalStateDefinition {
    dlg: string
    label: string
    line: number
    start: number
    end: number
}

class StateDefinitionCollector extends DlgAwareErroResistantVisitor<LocalStateDefinition[]> {

    protected defaultResult(): LocalStateDefinition[] {
        return [];
    }

    protected aggregateResult(aggregate: LocalStateDefinition[], nextResult: LocalStateDefinition[]): LocalStateDefinition[] {
        return aggregate.concat(nextResult);
    }

    visitIfThenState?: ((ctx: IfThenStateContext) => LocalStateDefinition[]) = ctx => {
        return [{
            dlg: this.currentDlg!,
            label: cleanString(ctx._label.text),
            start: ctx._label.start.charPositionInLine,
            end: ctx._label.start.charPositionInLine + ctx._label.text.length,
            line: ctx._label.start.line - 1,
        }]
    }
}

function makePartialLocationFromParseTree(ctx: ParserRuleContext) {
    return {
        range: {
            start: {
                line: ctx.start.line - 1,
                character: ctx.start.charPositionInLine
            },
            end: {
                line: ctx.stop!.line - 1,
                character: ctx.stop!.charPositionInLine + ctx.stop!.text!.length
            }
        }
    }
}

