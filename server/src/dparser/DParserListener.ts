// Generated from ./src/antlr4/lapdu/DParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";

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
 * This interface defines a complete listener for a parse tree produced by
 * `DParser`.
 */
export interface DParserListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the `genderedText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	enterGenderedText?: (ctx: GenderedTextContext) => void;
	/**
	 * Exit a parse tree produced by the `genderedText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	exitGenderedText?: (ctx: GenderedTextContext) => void;

	/**
	 * Enter a parse tree produced by the `genderNeutralText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	enterGenderNeutralText?: (ctx: GenderNeutralTextContext) => void;
	/**
	 * Exit a parse tree produced by the `genderNeutralText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	exitGenderNeutralText?: (ctx: GenderNeutralTextContext) => void;

	/**
	 * Enter a parse tree produced by the `referencedText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	enterReferencedText?: (ctx: ReferencedTextContext) => void;
	/**
	 * Exit a parse tree produced by the `referencedText`
	 * labeled alternative in `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	exitReferencedText?: (ctx: ReferencedTextContext) => void;

	/**
	 * Enter a parse tree produced by the `ifThenState`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	enterIfThenState?: (ctx: IfThenStateContext) => void;
	/**
	 * Exit a parse tree produced by the `ifThenState`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	exitIfThenState?: (ctx: IfThenStateContext) => void;

	/**
	 * Enter a parse tree produced by the `appendiState`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	enterAppendiState?: (ctx: AppendiStateContext) => void;
	/**
	 * Exit a parse tree produced by the `appendiState`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	exitAppendiState?: (ctx: AppendiStateContext) => void;

	/**
	 * Enter a parse tree produced by the `chain2State`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	enterChain2State?: (ctx: Chain2StateContext) => void;
	/**
	 * Exit a parse tree produced by the `chain2State`
	 * labeled alternative in `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	exitChain2State?: (ctx: Chain2StateContext) => void;

	/**
	 * Enter a parse tree produced by the `replyTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	enterReplyTransitionFeature?: (ctx: ReplyTransitionFeatureContext) => void;
	/**
	 * Exit a parse tree produced by the `replyTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	exitReplyTransitionFeature?: (ctx: ReplyTransitionFeatureContext) => void;

	/**
	 * Enter a parse tree produced by the `doTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	enterDoTransitionFeature?: (ctx: DoTransitionFeatureContext) => void;
	/**
	 * Exit a parse tree produced by the `doTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	exitDoTransitionFeature?: (ctx: DoTransitionFeatureContext) => void;

	/**
	 * Enter a parse tree produced by the `journalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	enterJournalTransitionFeature?: (ctx: JournalTransitionFeatureContext) => void;
	/**
	 * Exit a parse tree produced by the `journalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	exitJournalTransitionFeature?: (ctx: JournalTransitionFeatureContext) => void;

	/**
	 * Enter a parse tree produced by the `solvedJournalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	enterSolvedJournalTransitionFeature?: (ctx: SolvedJournalTransitionFeatureContext) => void;
	/**
	 * Exit a parse tree produced by the `solvedJournalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	exitSolvedJournalTransitionFeature?: (ctx: SolvedJournalTransitionFeatureContext) => void;

	/**
	 * Enter a parse tree produced by the `unsolvedJournalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	enterUnsolvedJournalTransitionFeature?: (ctx: UnsolvedJournalTransitionFeatureContext) => void;
	/**
	 * Exit a parse tree produced by the `unsolvedJournalTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	exitUnsolvedJournalTransitionFeature?: (ctx: UnsolvedJournalTransitionFeatureContext) => void;

	/**
	 * Enter a parse tree produced by the `flagsTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	enterFlagsTransitionFeature?: (ctx: FlagsTransitionFeatureContext) => void;
	/**
	 * Exit a parse tree produced by the `flagsTransitionFeature`
	 * labeled alternative in `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	exitFlagsTransitionFeature?: (ctx: FlagsTransitionFeatureContext) => void;

	/**
	 * Enter a parse tree produced by the `endChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	enterEndChainActionEpilog?: (ctx: EndChainActionEpilogContext) => void;
	/**
	 * Exit a parse tree produced by the `endChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	exitEndChainActionEpilog?: (ctx: EndChainActionEpilogContext) => void;

	/**
	 * Enter a parse tree produced by the `externChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	enterExternChainActionEpilog?: (ctx: ExternChainActionEpilogContext) => void;
	/**
	 * Exit a parse tree produced by the `externChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	exitExternChainActionEpilog?: (ctx: ExternChainActionEpilogContext) => void;

	/**
	 * Enter a parse tree produced by the `copyTransChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	enterCopyTransChainActionEpilog?: (ctx: CopyTransChainActionEpilogContext) => void;
	/**
	 * Exit a parse tree produced by the `copyTransChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	exitCopyTransChainActionEpilog?: (ctx: CopyTransChainActionEpilogContext) => void;

	/**
	 * Enter a parse tree produced by the `copyTransLateChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	enterCopyTransLateChainActionEpilog?: (ctx: CopyTransLateChainActionEpilogContext) => void;
	/**
	 * Exit a parse tree produced by the `copyTransLateChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	exitCopyTransLateChainActionEpilog?: (ctx: CopyTransLateChainActionEpilogContext) => void;

	/**
	 * Enter a parse tree produced by the `exitChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	enterExitChainActionEpilog?: (ctx: ExitChainActionEpilogContext) => void;
	/**
	 * Exit a parse tree produced by the `exitChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	exitExitChainActionEpilog?: (ctx: ExitChainActionEpilogContext) => void;

	/**
	 * Enter a parse tree produced by the `endWithTransitionsChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	enterEndWithTransitionsChainActionEpilog?: (ctx: EndWithTransitionsChainActionEpilogContext) => void;
	/**
	 * Exit a parse tree produced by the `endWithTransitionsChainActionEpilog`
	 * labeled alternative in `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	exitEndWithTransitionsChainActionEpilog?: (ctx: EndWithTransitionsChainActionEpilogContext) => void;

	/**
	 * Enter a parse tree produced by the `beginDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterBeginDAction?: (ctx: BeginDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `beginDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitBeginDAction?: (ctx: BeginDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `appendDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterAppendDAction?: (ctx: AppendDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `appendDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitAppendDAction?: (ctx: AppendDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `appendEarlyDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterAppendEarlyDAction?: (ctx: AppendEarlyDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `appendEarlyDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitAppendEarlyDAction?: (ctx: AppendEarlyDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `chainDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterChainDAction?: (ctx: ChainDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `chainDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitChainDAction?: (ctx: ChainDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `interjectDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterInterjectDAction?: (ctx: InterjectDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `interjectDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitInterjectDAction?: (ctx: InterjectDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `interjectCopyTransDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterInterjectCopyTransDAction?: (ctx: InterjectCopyTransDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `interjectCopyTransDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitInterjectCopyTransDAction?: (ctx: InterjectCopyTransDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `extendTopBottomDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterExtendTopBottomDAction?: (ctx: ExtendTopBottomDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `extendTopBottomDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitExtendTopBottomDAction?: (ctx: ExtendTopBottomDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `addStateTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterAddStateTriggerDAction?: (ctx: AddStateTriggerDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `addStateTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitAddStateTriggerDAction?: (ctx: AddStateTriggerDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `addTransTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterAddTransTriggerDAction?: (ctx: AddTransTriggerDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `addTransTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitAddTransTriggerDAction?: (ctx: AddTransTriggerDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `addTransActionDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterAddTransActionDAction?: (ctx: AddTransActionDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `addTransActionDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitAddTransActionDAction?: (ctx: AddTransActionDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceTransActionDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceTransActionDAction?: (ctx: ReplaceTransActionDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceTransActionDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceTransActionDAction?: (ctx: ReplaceTransActionDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceTransTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceTransTriggerDAction?: (ctx: ReplaceTransTriggerDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceTransTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceTransTriggerDAction?: (ctx: ReplaceTransTriggerDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `alterTransDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterAlterTransDAction?: (ctx: AlterTransDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `alterTransDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitAlterTransDAction?: (ctx: AlterTransDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceDAction?: (ctx: ReplaceDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceDAction?: (ctx: ReplaceDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `setWeightDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterSetWeightDAction?: (ctx: SetWeightDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `setWeightDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitSetWeightDAction?: (ctx: SetWeightDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceSayDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceSayDAction?: (ctx: ReplaceSayDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceSayDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceSayDAction?: (ctx: ReplaceSayDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceStateTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceStateTriggerDAction?: (ctx: ReplaceStateTriggerDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceStateTriggerDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceStateTriggerDAction?: (ctx: ReplaceStateTriggerDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceTriggerTextDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceTriggerTextDAction?: (ctx: ReplaceTriggerTextDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceTriggerTextDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceTriggerTextDAction?: (ctx: ReplaceTriggerTextDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceTriggerTextRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceTriggerTextRegexpDAction?: (ctx: ReplaceTriggerTextRegexpDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceTriggerTextRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceTriggerTextRegexpDAction?: (ctx: ReplaceTriggerTextRegexpDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceActionTextDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceActionTextDAction?: (ctx: ReplaceActionTextDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceActionTextDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceActionTextDAction?: (ctx: ReplaceActionTextDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceActionTextRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceActionTextRegexpDAction?: (ctx: ReplaceActionTextRegexpDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceActionTextRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceActionTextRegexpDAction?: (ctx: ReplaceActionTextRegexpDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `replaceActionTextProcessDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceActionTextProcessDAction?: (ctx: ReplaceActionTextProcessDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `replaceActionTextProcessDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceActionTextProcessDAction?: (ctx: ReplaceActionTextProcessDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `ReplaceActionTextProcessRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterReplaceActionTextProcessRegexpDAction?: (ctx: ReplaceActionTextProcessRegexpDActionContext) => void;
	/**
	 * Exit a parse tree produced by the `ReplaceActionTextProcessRegexpDAction`
	 * labeled alternative in `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitReplaceActionTextProcessRegexpDAction?: (ctx: ReplaceActionTextProcessRegexpDActionContext) => void;

	/**
	 * Enter a parse tree produced by the `ifThenTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	enterIfThenTransition?: (ctx: IfThenTransitionContext) => void;
	/**
	 * Exit a parse tree produced by the `ifThenTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	exitIfThenTransition?: (ctx: IfThenTransitionContext) => void;

	/**
	 * Enter a parse tree produced by the `replyTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	enterReplyTransition?: (ctx: ReplyTransitionContext) => void;
	/**
	 * Exit a parse tree produced by the `replyTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	exitReplyTransition?: (ctx: ReplyTransitionContext) => void;

	/**
	 * Enter a parse tree produced by the `copyTransTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	enterCopyTransTransition?: (ctx: CopyTransTransitionContext) => void;
	/**
	 * Exit a parse tree produced by the `copyTransTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	exitCopyTransTransition?: (ctx: CopyTransTransitionContext) => void;

	/**
	 * Enter a parse tree produced by the `copyTransLateTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	enterCopyTransLateTransition?: (ctx: CopyTransLateTransitionContext) => void;
	/**
	 * Exit a parse tree produced by the `copyTransLateTransition`
	 * labeled alternative in `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	exitCopyTransLateTransition?: (ctx: CopyTransLateTransitionContext) => void;

	/**
	 * Enter a parse tree produced by the `monologChainBlock`
	 * labeled alternative in `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 */
	enterMonologChainBlock?: (ctx: MonologChainBlockContext) => void;
	/**
	 * Exit a parse tree produced by the `monologChainBlock`
	 * labeled alternative in `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 */
	exitMonologChainBlock?: (ctx: MonologChainBlockContext) => void;

	/**
	 * Enter a parse tree produced by the `branchChainBlock`
	 * labeled alternative in `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 */
	enterBranchChainBlock?: (ctx: BranchChainBlockContext) => void;
	/**
	 * Exit a parse tree produced by the `branchChainBlock`
	 * labeled alternative in `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 */
	exitBranchChainBlock?: (ctx: BranchChainBlockContext) => void;

	/**
	 * Enter a parse tree produced by the `gotoTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	enterGotoTransitionTarget?: (ctx: GotoTransitionTargetContext) => void;
	/**
	 * Exit a parse tree produced by the `gotoTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	exitGotoTransitionTarget?: (ctx: GotoTransitionTargetContext) => void;

	/**
	 * Enter a parse tree produced by the `externTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	enterExternTransitionTarget?: (ctx: ExternTransitionTargetContext) => void;
	/**
	 * Exit a parse tree produced by the `externTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	exitExternTransitionTarget?: (ctx: ExternTransitionTargetContext) => void;

	/**
	 * Enter a parse tree produced by the `exitTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	enterExitTransitionTarget?: (ctx: ExitTransitionTargetContext) => void;
	/**
	 * Exit a parse tree produced by the `exitTransitionTarget`
	 * labeled alternative in `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	exitExitTransitionTarget?: (ctx: ExitTransitionTargetContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.rootRule`.
	 * @param ctx the parse tree
	 */
	enterRootRule?: (ctx: RootRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.rootRule`.
	 * @param ctx the parse tree
	 */
	exitRootRule?: (ctx: RootRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.dFileRule`.
	 * @param ctx the parse tree
	 */
	enterDFileRule?: (ctx: DFileRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.dFileRule`.
	 * @param ctx the parse tree
	 */
	exitDFileRule?: (ctx: DFileRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	enterDActionRule?: (ctx: DActionRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.dActionRule`.
	 * @param ctx the parse tree
	 */
	exitDActionRule?: (ctx: DActionRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.alterTransCommand`.
	 * @param ctx the parse tree
	 */
	enterAlterTransCommand?: (ctx: AlterTransCommandContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.alterTransCommand`.
	 * @param ctx the parse tree
	 */
	exitAlterTransCommand?: (ctx: AlterTransCommandContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.conditionRule`.
	 * @param ctx the parse tree
	 */
	enterConditionRule?: (ctx: ConditionRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.conditionRule`.
	 * @param ctx the parse tree
	 */
	exitConditionRule?: (ctx: ConditionRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	enterStateRule?: (ctx: StateRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.stateRule`.
	 * @param ctx the parse tree
	 */
	exitStateRule?: (ctx: StateRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.chain2DlgRule`.
	 * @param ctx the parse tree
	 */
	enterChain2DlgRule?: (ctx: Chain2DlgRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.chain2DlgRule`.
	 * @param ctx the parse tree
	 */
	exitChain2DlgRule?: (ctx: Chain2DlgRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.chain2ElementRule`.
	 * @param ctx the parse tree
	 */
	enterChain2ElementRule?: (ctx: Chain2ElementRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.chain2ElementRule`.
	 * @param ctx the parse tree
	 */
	exitChain2ElementRule?: (ctx: Chain2ElementRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	enterTransitionRule?: (ctx: TransitionRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.transitionRule`.
	 * @param ctx the parse tree
	 */
	exitTransitionRule?: (ctx: TransitionRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	enterTransitionTargetRule?: (ctx: TransitionTargetRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.transitionTargetRule`.
	 * @param ctx the parse tree
	 */
	exitTransitionTargetRule?: (ctx: TransitionTargetRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	enterChainActionEpilogRule?: (ctx: ChainActionEpilogRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.chainActionEpilogRule`.
	 * @param ctx the parse tree
	 */
	exitChainActionEpilogRule?: (ctx: ChainActionEpilogRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	enterTransitionFeatureRule?: (ctx: TransitionFeatureRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.transitionFeatureRule`.
	 * @param ctx the parse tree
	 */
	exitTransitionFeatureRule?: (ctx: TransitionFeatureRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.chainDlgRule`.
	 * @param ctx the parse tree
	 */
	enterChainDlgRule?: (ctx: ChainDlgRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.chainDlgRule`.
	 * @param ctx the parse tree
	 */
	exitChainDlgRule?: (ctx: ChainDlgRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 */
	enterChainBlockRule?: (ctx: ChainBlockRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.chainBlockRule`.
	 * @param ctx the parse tree
	 */
	exitChainBlockRule?: (ctx: ChainBlockRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.chainElementRule`.
	 * @param ctx the parse tree
	 */
	enterChainElementRule?: (ctx: ChainElementRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.chainElementRule`.
	 * @param ctx the parse tree
	 */
	exitChainElementRule?: (ctx: ChainElementRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.fileRule`.
	 * @param ctx the parse tree
	 */
	enterFileRule?: (ctx: FileRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.fileRule`.
	 * @param ctx the parse tree
	 */
	exitFileRule?: (ctx: FileRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.sayTextRule`.
	 * @param ctx the parse tree
	 */
	enterSayTextRule?: (ctx: SayTextRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.sayTextRule`.
	 * @param ctx the parse tree
	 */
	exitSayTextRule?: (ctx: SayTextRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.traLineRule`.
	 * @param ctx the parse tree
	 */
	enterTraLineRule?: (ctx: TraLineRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.traLineRule`.
	 * @param ctx the parse tree
	 */
	exitTraLineRule?: (ctx: TraLineRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	enterDlgLineRule?: (ctx: DlgLineRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.dlgLineRule`.
	 * @param ctx the parse tree
	 */
	exitDlgLineRule?: (ctx: DlgLineRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.stringRule`.
	 * @param ctx the parse tree
	 */
	enterStringRule?: (ctx: StringRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.stringRule`.
	 * @param ctx the parse tree
	 */
	exitStringRule?: (ctx: StringRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.stringLiteralRule`.
	 * @param ctx the parse tree
	 */
	enterStringLiteralRule?: (ctx: StringLiteralRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.stringLiteralRule`.
	 * @param ctx the parse tree
	 */
	exitStringLiteralRule?: (ctx: StringLiteralRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.identifierRule`.
	 * @param ctx the parse tree
	 */
	enterIdentifierRule?: (ctx: IdentifierRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.identifierRule`.
	 * @param ctx the parse tree
	 */
	exitIdentifierRule?: (ctx: IdentifierRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.referenceRule`.
	 * @param ctx the parse tree
	 */
	enterReferenceRule?: (ctx: ReferenceRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.referenceRule`.
	 * @param ctx the parse tree
	 */
	exitReferenceRule?: (ctx: ReferenceRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.sharpNumberRule`.
	 * @param ctx the parse tree
	 */
	enterSharpNumberRule?: (ctx: SharpNumberRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.sharpNumberRule`.
	 * @param ctx the parse tree
	 */
	exitSharpNumberRule?: (ctx: SharpNumberRuleContext) => void;

	/**
	 * Enter a parse tree produced by `DParser.soundRule`.
	 * @param ctx the parse tree
	 */
	enterSoundRule?: (ctx: SoundRuleContext) => void;
	/**
	 * Exit a parse tree produced by `DParser.soundRule`.
	 * @param ctx the parse tree
	 */
	exitSoundRule?: (ctx: SoundRuleContext) => void;
}

