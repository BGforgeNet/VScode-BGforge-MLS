// Generated from ./src/antlr4/lapdu/DParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";

import { GenderedTextContext } from "./DParser";
import { GenderNeutralTextContext } from "./DParser";
import { ReferencedTextContext } from "./DParser";
import { IfThenStateContext } from "./DParser";
import { AppendiStateContext } from "./DParser";
import { Chain2StateContext } from "./DParser";
import { ReplyTransitionFeatureContext } from "./DParser";
import { DoTransitionFeatureContext } from "./DParser";
import { JournalTransitionFeatureContext } from "./DParser";
import { SolvedJournalTransitionFeatureContext } from "./DParser";
import { UnsolvedJournalTransitionFeatureContext } from "./DParser";
import { FlagsTransitionFeatureContext } from "./DParser";
import { EndChainActionEpilogContext } from "./DParser";
import { ExternChainActionEpilogContext } from "./DParser";
import { CopyTransChainActionEpilogContext } from "./DParser";
import { CopyTransLateChainActionEpilogContext } from "./DParser";
import { ExitChainActionEpilogContext } from "./DParser";
import { EndWithTransitionsChainActionEpilogContext } from "./DParser";
import { BeginDActionContext } from "./DParser";
import { AppendDActionContext } from "./DParser";
import { AppendEarlyDActionContext } from "./DParser";
import { ChainDActionContext } from "./DParser";
import { InterjectDActionContext } from "./DParser";
import { InterjectCopyTransDActionContext } from "./DParser";
import { ExtendTopBottomDActionContext } from "./DParser";
import { AddStateTriggerDActionContext } from "./DParser";
import { AddTransTriggerDActionContext } from "./DParser";
import { AddTransActionDActionContext } from "./DParser";
import { ReplaceTransActionDActionContext } from "./DParser";
import { ReplaceTransTriggerDActionContext } from "./DParser";
import { AlterTransDActionContext } from "./DParser";
import { ReplaceDActionContext } from "./DParser";
import { SetWeightDActionContext } from "./DParser";
import { ReplaceSayDActionContext } from "./DParser";
import { ReplaceStateTriggerDActionContext } from "./DParser";
import { ReplaceTriggerTextDActionContext } from "./DParser";
import { ReplaceTriggerTextRegexpDActionContext } from "./DParser";
import { ReplaceActionTextDActionContext } from "./DParser";
import { ReplaceActionTextRegexpDActionContext } from "./DParser";
import { ReplaceActionTextProcessDActionContext } from "./DParser";
import { ReplaceActionTextProcessRegexpDActionContext } from "./DParser";
import { IfThenTransitionContext } from "./DParser";
import { ReplyTransitionContext } from "./DParser";
import { CopyTransTransitionContext } from "./DParser";
import { CopyTransLateTransitionContext } from "./DParser";
import { MonologChainBlockContext } from "./DParser";
import { BranchChainBlockContext } from "./DParser";
import { GotoTransitionTargetContext } from "./DParser";
import { ExternTransitionTargetContext } from "./DParser";
import { ExitTransitionTargetContext } from "./DParser";
import { RootRuleContext } from "./DParser";
import { DFileRuleContext } from "./DParser";
import { DActionRuleContext } from "./DParser";
import { AlterTransCommandContext } from "./DParser";
import { ConditionRuleContext } from "./DParser";
import { StateRuleContext } from "./DParser";
import { Chain2DlgRuleContext } from "./DParser";
import { Chain2ElementRuleContext } from "./DParser";
import { TransitionRuleContext } from "./DParser";
import { TransitionTargetRuleContext } from "./DParser";
import { ChainActionEpilogRuleContext } from "./DParser";
import { TransitionFeatureRuleContext } from "./DParser";
import { ChainDlgRuleContext } from "./DParser";
import { ChainBlockRuleContext } from "./DParser";
import { ChainElementRuleContext } from "./DParser";
import { FileRuleContext } from "./DParser";
import { SayTextRuleContext } from "./DParser";
import { TraLineRuleContext } from "./DParser";
import { DlgLineRuleContext } from "./DParser";
import { StringRuleContext } from "./DParser";
import { StringLiteralRuleContext } from "./DParser";
import { IdentifierRuleContext } from "./DParser";
import { ReferenceRuleContext } from "./DParser";
import { SharpNumberRuleContext } from "./DParser";
import { SoundRuleContext } from "./DParser";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `DParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export interface DParserVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by the `genderedText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitGenderedText?: (ctx: GenderedTextContext) => Result;

	/**
	 * Visit a parse tree produced by the `genderNeutralText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitGenderNeutralText?: (ctx: GenderNeutralTextContext) => Result;

	/**
	 * Visit a parse tree produced by the `referencedText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReferencedText?: (ctx: ReferencedTextContext) => Result;

	/**
	 * Visit a parse tree produced by the `ifThenState`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIfThenState?: (ctx: IfThenStateContext) => Result;

	/**
	 * Visit a parse tree produced by the `appendiState`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAppendiState?: (ctx: AppendiStateContext) => Result;

	/**
	 * Visit a parse tree produced by the `chain2State`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChain2State?: (ctx: Chain2StateContext) => Result;

	/**
	 * Visit a parse tree produced by the `replyTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplyTransitionFeature?: (ctx: ReplyTransitionFeatureContext) => Result;

	/**
	 * Visit a parse tree produced by the `doTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDoTransitionFeature?: (ctx: DoTransitionFeatureContext) => Result;

	/**
	 * Visit a parse tree produced by the `journalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJournalTransitionFeature?: (ctx: JournalTransitionFeatureContext) => Result;

	/**
	 * Visit a parse tree produced by the `solvedJournalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSolvedJournalTransitionFeature?: (ctx: SolvedJournalTransitionFeatureContext) => Result;

	/**
	 * Visit a parse tree produced by the `unsolvedJournalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUnsolvedJournalTransitionFeature?: (ctx: UnsolvedJournalTransitionFeatureContext) => Result;

	/**
	 * Visit a parse tree produced by the `flagsTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFlagsTransitionFeature?: (ctx: FlagsTransitionFeatureContext) => Result;

	/**
	 * Visit a parse tree produced by the `endChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEndChainActionEpilog?: (ctx: EndChainActionEpilogContext) => Result;

	/**
	 * Visit a parse tree produced by the `externChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExternChainActionEpilog?: (ctx: ExternChainActionEpilogContext) => Result;

	/**
	 * Visit a parse tree produced by the `copyTransChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCopyTransChainActionEpilog?: (ctx: CopyTransChainActionEpilogContext) => Result;

	/**
	 * Visit a parse tree produced by the `copyTransLateChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCopyTransLateChainActionEpilog?: (ctx: CopyTransLateChainActionEpilogContext) => Result;

	/**
	 * Visit a parse tree produced by the `exitChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExitChainActionEpilog?: (ctx: ExitChainActionEpilogContext) => Result;

	/**
	 * Visit a parse tree produced by the `endWithTransitionsChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEndWithTransitionsChainActionEpilog?: (ctx: EndWithTransitionsChainActionEpilogContext) => Result;

	/**
	 * Visit a parse tree produced by the `beginDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBeginDAction?: (ctx: BeginDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `appendDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAppendDAction?: (ctx: AppendDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `appendEarlyDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAppendEarlyDAction?: (ctx: AppendEarlyDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `chainDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChainDAction?: (ctx: ChainDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `interjectDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInterjectDAction?: (ctx: InterjectDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `interjectCopyTransDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInterjectCopyTransDAction?: (ctx: InterjectCopyTransDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `extendTopBottomDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExtendTopBottomDAction?: (ctx: ExtendTopBottomDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `addStateTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAddStateTriggerDAction?: (ctx: AddStateTriggerDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `addTransTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAddTransTriggerDAction?: (ctx: AddTransTriggerDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `addTransActionDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAddTransActionDAction?: (ctx: AddTransActionDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceTransActionDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceTransActionDAction?: (ctx: ReplaceTransActionDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceTransTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceTransTriggerDAction?: (ctx: ReplaceTransTriggerDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `alterTransDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAlterTransDAction?: (ctx: AlterTransDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceDAction?: (ctx: ReplaceDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `setWeightDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSetWeightDAction?: (ctx: SetWeightDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceSayDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceSayDAction?: (ctx: ReplaceSayDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceStateTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceStateTriggerDAction?: (ctx: ReplaceStateTriggerDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceTriggerTextDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceTriggerTextDAction?: (ctx: ReplaceTriggerTextDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceTriggerTextRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceTriggerTextRegexpDAction?: (ctx: ReplaceTriggerTextRegexpDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceActionTextDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceActionTextDAction?: (ctx: ReplaceActionTextDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceActionTextRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceActionTextRegexpDAction?: (ctx: ReplaceActionTextRegexpDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replaceActionTextProcessDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceActionTextProcessDAction?: (ctx: ReplaceActionTextProcessDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `ReplaceActionTextProcessRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplaceActionTextProcessRegexpDAction?: (ctx: ReplaceActionTextProcessRegexpDActionContext) => Result;

	/**
	 * Visit a parse tree produced by the `ifThenTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIfThenTransition?: (ctx: IfThenTransitionContext) => Result;

	/**
	 * Visit a parse tree produced by the `replyTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReplyTransition?: (ctx: ReplyTransitionContext) => Result;

	/**
	 * Visit a parse tree produced by the `copyTransTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCopyTransTransition?: (ctx: CopyTransTransitionContext) => Result;

	/**
	 * Visit a parse tree produced by the `copyTransLateTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCopyTransLateTransition?: (ctx: CopyTransLateTransitionContext) => Result;

	/**
	 * Visit a parse tree produced by the `monologChainBlock`
	 * labeled alternative in `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMonologChainBlock?: (ctx: MonologChainBlockContext) => Result;

	/**
	 * Visit a parse tree produced by the `branchChainBlock`
	 * labeled alternative in `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBranchChainBlock?: (ctx: BranchChainBlockContext) => Result;

	/**
	 * Visit a parse tree produced by the `gotoTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitGotoTransitionTarget?: (ctx: GotoTransitionTargetContext) => Result;

	/**
	 * Visit a parse tree produced by the `externTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExternTransitionTarget?: (ctx: ExternTransitionTargetContext) => Result;

	/**
	 * Visit a parse tree produced by the `exitTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExitTransitionTarget?: (ctx: ExitTransitionTargetContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.rootRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRootRule?: (ctx: RootRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.dFileRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDFileRule?: (ctx: DFileRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.dActionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDActionRule?: (ctx: DActionRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.alterTransCommand`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAlterTransCommand?: (ctx: AlterTransCommandContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.conditionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConditionRule?: (ctx: ConditionRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.stateRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStateRule?: (ctx: StateRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.chain2DlgRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChain2DlgRule?: (ctx: Chain2DlgRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.chain2ElementRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChain2ElementRule?: (ctx: Chain2ElementRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.transitionRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTransitionRule?: (ctx: TransitionRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTransitionTargetRule?: (ctx: TransitionTargetRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChainActionEpilogRule?: (ctx: ChainActionEpilogRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTransitionFeatureRule?: (ctx: TransitionFeatureRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.chainDlgRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChainDlgRule?: (ctx: ChainDlgRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChainBlockRule?: (ctx: ChainBlockRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.chainElementRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitChainElementRule?: (ctx: ChainElementRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.fileRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFileRule?: (ctx: FileRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.sayTextRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSayTextRule?: (ctx: SayTextRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.traLineRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTraLineRule?: (ctx: TraLineRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDlgLineRule?: (ctx: DlgLineRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.stringRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStringRule?: (ctx: StringRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.stringLiteralRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStringLiteralRule?: (ctx: StringLiteralRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.identifierRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIdentifierRule?: (ctx: IdentifierRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.referenceRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReferenceRule?: (ctx: ReferenceRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.sharpNumberRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSharpNumberRule?: (ctx: SharpNumberRuleContext) => Result;

	/**
	 * Visit a parse tree produced by `DParser.soundRule`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSoundRule?: (ctx: SoundRuleContext) => Result;
}

