// Generated from ./src/antlr4/lapdu/DParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ATN } from "antlr4ts/atn/ATN";
import { ATNDeserializer } from "antlr4ts/atn/ATNDeserializer";
import { FailedPredicateException } from "antlr4ts/FailedPredicateException";
import { NotNull } from "antlr4ts/Decorators";
import { NoViableAltException } from "antlr4ts/NoViableAltException";
import { Override } from "antlr4ts/Decorators";
import { Parser } from "antlr4ts/Parser";
import { ParserRuleContext } from "antlr4ts/ParserRuleContext";
import { ParserATNSimulator } from "antlr4ts/atn/ParserATNSimulator";
import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";
import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";
import { RecognitionException } from "antlr4ts/RecognitionException";
import { RuleContext } from "antlr4ts/RuleContext";
//import { RuleVersion } from "antlr4ts/RuleVersion";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { Token } from "antlr4ts/Token";
import { TokenStream } from "antlr4ts/TokenStream";
import { Vocabulary } from "antlr4ts/Vocabulary";
import { VocabularyImpl } from "antlr4ts/VocabularyImpl";

import * as Utils from "antlr4ts/misc/Utils";

import { DParserListener } from "./DParserListener";
import { DParserVisitor } from "./DParserVisitor";


export class DParser extends Parser {
	public static readonly BLOCK_COMMENT = 1;
	public static readonly WHITESPACE = 2;
	public static readonly BEGIN = 3;
	public static readonly END = 4;
	public static readonly IF = 5;
	public static readonly UNLESS = 6;
	public static readonly WEIGHT = 7;
	public static readonly THEN = 8;
	public static readonly EQ = 9;
	public static readonly EQEQ = 10;
	public static readonly BRANCH = 11;
	public static readonly PLUS = 12;
	public static readonly COPY_TRANS = 13;
	public static readonly COPY_TRANS_LATE = 14;
	public static readonly DO = 15;
	public static readonly JOURNAL = 16;
	public static readonly SOLVED_JOURNAL = 17;
	public static readonly UNSOLVED_JOURNAL = 18;
	public static readonly FLAGS = 19;
	public static readonly GOTO = 20;
	public static readonly APPENDI = 21;
	public static readonly CHAIN2 = 22;
	public static readonly SAFE = 23;
	public static readonly EXTERN = 24;
	public static readonly REPLY = 25;
	public static readonly EXIT = 26;
	public static readonly SAY = 27;
	public static readonly IF_FILE_EXISTS = 28;
	public static readonly PAREN_OPEN = 29;
	public static readonly PAREN_CLOSE = 30;
	public static readonly AT = 31;
	public static readonly APPEND = 32;
	public static readonly APPEND_EARLY = 33;
	public static readonly CHAIN = 34;
	public static readonly INTERJECT = 35;
	public static readonly EXTEND_TOP = 36;
	public static readonly ADD_STATE_TRIGGER = 37;
	public static readonly ADD_TRANS_TRIGGER = 38;
	public static readonly ADD_TRANS_ACTION = 39;
	public static readonly REPLACE_TRANS_ACTION = 40;
	public static readonly REPLACE_TRANS_TRIGGER = 41;
	public static readonly ALTER_TRANS = 42;
	public static readonly REPLACE = 43;
	public static readonly SET_WEIGHT = 44;
	public static readonly REPLACE_STATE_TRIGGER = 45;
	public static readonly REPLACE_TRIGGER_TEXT = 46;
	public static readonly REPLACE_TRIGGER_TEXT_REGEXP = 47;
	public static readonly REPLACE_ACTION_TEXT = 48;
	public static readonly REPLACE_ACTION_TEXT_REGEXP = 49;
	public static readonly REPLACE_ACTION_TEXT_PROCESS = 50;
	public static readonly REPLACE_ACTION_TEXT_PROCESS_REGEXP = 51;
	public static readonly REPLACE_SAY = 52;
	public static readonly EXTEND_BOTTOM = 53;
	public static readonly INTERJECT_COPY_TRANS = 54;
	public static readonly INTERJECT_COPY_TRANS2 = 55;
	public static readonly INTERJECT_COPY_TRANS3 = 56;
	public static readonly INTERJECT_COPY_TRANS4 = 57;
	public static readonly SHARP_NUMBER = 58;
	public static readonly SOUND_STRING = 59;
	public static readonly TILDE_STRING = 60;
	public static readonly QUOTE_STRING = 61;
	public static readonly PERCENT_STRING = 62;
	public static readonly FORCED_STRING_REFERENCE = 63;
	public static readonly TRANSLATION_REFERENCE = 64;
	public static readonly CONCAT = 65;
	public static readonly LINE_COMMENT = 66;
	public static readonly IDENTIFIER = 67;
	public static readonly LONG_TILDE_STRING = 68;
	public static readonly LONG_TILDE_STRING_UNTERMINATED = 69;
	public static readonly BLOCK_COMMENT_END = 70;
	public static readonly UNTERMINATED_BLOCK_COMMENT = 71;
	public static readonly LONG_TILDE_STRING_START = 72;
	public static readonly BLOCK_COMMENT_START = 73;
	public static readonly RULE_rootRule = 0;
	public static readonly RULE_dFileRule = 1;
	public static readonly RULE_dActionRule = 2;
	public static readonly RULE_alterTransCommand = 3;
	public static readonly RULE_conditionRule = 4;
	public static readonly RULE_stateRule = 5;
	public static readonly RULE_chain2DlgRule = 6;
	public static readonly RULE_chain2ElementRule = 7;
	public static readonly RULE_transitionRule = 8;
	public static readonly RULE_transitionTargetRule = 9;
	public static readonly RULE_chainActionEpilogRule = 10;
	public static readonly RULE_transitionFeatureRule = 11;
	public static readonly RULE_chainDlgRule = 12;
	public static readonly RULE_chainBlockRule = 13;
	public static readonly RULE_chainElementRule = 14;
	public static readonly RULE_fileRule = 15;
	public static readonly RULE_sayTextRule = 16;
	public static readonly RULE_traLineRule = 17;
	public static readonly RULE_dlgLineRule = 18;
	public static readonly RULE_stringRule = 19;
	public static readonly RULE_stringLiteralRule = 20;
	public static readonly RULE_identifierRule = 21;
	public static readonly RULE_referenceRule = 22;
	public static readonly RULE_sharpNumberRule = 23;
	public static readonly RULE_soundRule = 24;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"rootRule", "dFileRule", "dActionRule", "alterTransCommand", "conditionRule", 
		"stateRule", "chain2DlgRule", "chain2ElementRule", "transitionRule", "transitionTargetRule", 
		"chainActionEpilogRule", "transitionFeatureRule", "chainDlgRule", "chainBlockRule", 
		"chainElementRule", "fileRule", "sayTextRule", "traLineRule", "dlgLineRule", 
		"stringRule", "stringLiteralRule", "identifierRule", "referenceRule", 
		"sharpNumberRule", "soundRule",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, undefined, undefined, "'BEGIN'", "'END'", "'IF'", "'UNLESS'", 
		"'WEIGHT'", "'THEN'", "'='", "'=='", "'BRANCH'", "'+'", "'COPY_TRANS'", 
		"'COPY_TRANS_LATE'", "'DO'", "'JOURNAL'", "'SOLVED_JOURNAL'", "'UNSOLVED_JOURNAL'", 
		"'FLAGS'", "'GOTO'", "'APPENDI'", "'CHAIN2'", "'SAFE'", "'EXTERN'", "'REPLY'", 
		"'EXIT'", "'SAY'", "'IF_FILE_EXISTS'", "'('", "')'", "'AT'", "'APPEND'", 
		"'APPEND_EARLY'", undefined, "'INTERJECT'", "'EXTEND_TOP'", undefined, 
		undefined, "'ADD_TRANS_ACTION'", "'REPLACE_TRANS_ACTION'", "'REPLACE_TRANS_TRIGGER'", 
		"'ALTER_TRANS'", "'REPLACE'", "'SET_WEIGHT'", undefined, undefined, "'REPLACE_TRIGGER_TEXT_REGEXP'", 
		undefined, "'REPLACE_ACTION_TEXT_REGEXP'", "'REPLACE_ACTION_TEXT_PROCESS'", 
		undefined, "'REPLACE_SAY'", undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, "'^'", undefined, undefined, undefined, undefined, "'*/'",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "BLOCK_COMMENT", "WHITESPACE", "BEGIN", "END", "IF", "UNLESS", 
		"WEIGHT", "THEN", "EQ", "EQEQ", "BRANCH", "PLUS", "COPY_TRANS", "COPY_TRANS_LATE", 
		"DO", "JOURNAL", "SOLVED_JOURNAL", "UNSOLVED_JOURNAL", "FLAGS", "GOTO", 
		"APPENDI", "CHAIN2", "SAFE", "EXTERN", "REPLY", "EXIT", "SAY", "IF_FILE_EXISTS", 
		"PAREN_OPEN", "PAREN_CLOSE", "AT", "APPEND", "APPEND_EARLY", "CHAIN", 
		"INTERJECT", "EXTEND_TOP", "ADD_STATE_TRIGGER", "ADD_TRANS_TRIGGER", "ADD_TRANS_ACTION", 
		"REPLACE_TRANS_ACTION", "REPLACE_TRANS_TRIGGER", "ALTER_TRANS", "REPLACE", 
		"SET_WEIGHT", "REPLACE_STATE_TRIGGER", "REPLACE_TRIGGER_TEXT", "REPLACE_TRIGGER_TEXT_REGEXP", 
		"REPLACE_ACTION_TEXT", "REPLACE_ACTION_TEXT_REGEXP", "REPLACE_ACTION_TEXT_PROCESS", 
		"REPLACE_ACTION_TEXT_PROCESS_REGEXP", "REPLACE_SAY", "EXTEND_BOTTOM", 
		"INTERJECT_COPY_TRANS", "INTERJECT_COPY_TRANS2", "INTERJECT_COPY_TRANS3", 
		"INTERJECT_COPY_TRANS4", "SHARP_NUMBER", "SOUND_STRING", "TILDE_STRING", 
		"QUOTE_STRING", "PERCENT_STRING", "FORCED_STRING_REFERENCE", "TRANSLATION_REFERENCE", 
		"CONCAT", "LINE_COMMENT", "IDENTIFIER", "LONG_TILDE_STRING", "LONG_TILDE_STRING_UNTERMINATED", 
		"BLOCK_COMMENT_END", "UNTERMINATED_BLOCK_COMMENT", "LONG_TILDE_STRING_START", 
		"BLOCK_COMMENT_START",
	];
	public static readonly VOCABULARY: Vocabulary = new VocabularyImpl(DParser._LITERAL_NAMES, DParser._SYMBOLIC_NAMES, []);

	// @Override
	// @NotNull
	public get vocabulary(): Vocabulary {
		return DParser.VOCABULARY;
	}
	// tslint:enable:no-trailing-whitespace

	// @Override
	public get grammarFileName(): string { return "DParser.g4"; }

	// @Override
	public get ruleNames(): string[] { return DParser.ruleNames; }

	// @Override
	public get serializedATN(): string { return DParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(DParser._ATN, this);
	}
	// @RuleVersion(0)
	public rootRule(): RootRuleContext {
		let _localctx: RootRuleContext = new RootRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 0, DParser.RULE_rootRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 50;
			this.dFileRule();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public dFileRule(): DFileRuleContext {
		let _localctx: DFileRuleContext = new DFileRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 2, DParser.RULE_dFileRule);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 55;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === DParser.BEGIN || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (DParser.APPEND - 32)) | (1 << (DParser.APPEND_EARLY - 32)) | (1 << (DParser.CHAIN - 32)) | (1 << (DParser.INTERJECT - 32)) | (1 << (DParser.EXTEND_TOP - 32)) | (1 << (DParser.ADD_STATE_TRIGGER - 32)) | (1 << (DParser.ADD_TRANS_TRIGGER - 32)) | (1 << (DParser.ADD_TRANS_ACTION - 32)) | (1 << (DParser.REPLACE_TRANS_ACTION - 32)) | (1 << (DParser.REPLACE_TRANS_TRIGGER - 32)) | (1 << (DParser.ALTER_TRANS - 32)) | (1 << (DParser.REPLACE - 32)) | (1 << (DParser.SET_WEIGHT - 32)) | (1 << (DParser.REPLACE_STATE_TRIGGER - 32)) | (1 << (DParser.REPLACE_TRIGGER_TEXT - 32)) | (1 << (DParser.REPLACE_TRIGGER_TEXT_REGEXP - 32)) | (1 << (DParser.REPLACE_ACTION_TEXT - 32)) | (1 << (DParser.REPLACE_ACTION_TEXT_REGEXP - 32)) | (1 << (DParser.REPLACE_ACTION_TEXT_PROCESS - 32)) | (1 << (DParser.REPLACE_ACTION_TEXT_PROCESS_REGEXP - 32)) | (1 << (DParser.REPLACE_SAY - 32)) | (1 << (DParser.EXTEND_BOTTOM - 32)) | (1 << (DParser.INTERJECT_COPY_TRANS - 32)) | (1 << (DParser.INTERJECT_COPY_TRANS2 - 32)) | (1 << (DParser.INTERJECT_COPY_TRANS3 - 32)) | (1 << (DParser.INTERJECT_COPY_TRANS4 - 32)))) !== 0)) {
				{
				{
				this.state = 52;
				_localctx._dActionRule = this.dActionRule();
				_localctx._actions.push(_localctx._dActionRule);
				}
				}
				this.state = 57;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 58;
			this.match(DParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public dActionRule(): DActionRuleContext {
		let _localctx: DActionRuleContext = new DActionRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 4, DParser.RULE_dActionRule);
		let _la: number;
		try {
			this.state = 438;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.BEGIN:
				_localctx = new BeginDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 60;
				this.match(DParser.BEGIN);
				this.state = 61;
				(_localctx as BeginDActionContext)._dlg = this.fileRule();
				this.state = 63;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					this.state = 62;
					(_localctx as BeginDActionContext)._nonPausing = this.stringRule();
					}
				}

				this.state = 68;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.APPENDI) | (1 << DParser.CHAIN2))) !== 0)) {
					{
					{
					this.state = 65;
					(_localctx as BeginDActionContext)._stateRule = this.stateRule();
					(_localctx as BeginDActionContext)._states.push((_localctx as BeginDActionContext)._stateRule);
					}
					}
					this.state = 70;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.APPEND:
				_localctx = new AppendDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 71;
				this.match(DParser.APPEND);
				this.state = 73;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.IF_FILE_EXISTS) {
					{
					this.state = 72;
					(_localctx as AppendDActionContext)._ifExists = this.match(DParser.IF_FILE_EXISTS);
					}
				}

				this.state = 75;
				(_localctx as AppendDActionContext)._dlg = this.fileRule();
				this.state = 79;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.APPENDI) | (1 << DParser.CHAIN2))) !== 0)) {
					{
					{
					this.state = 76;
					(_localctx as AppendDActionContext)._stateRule = this.stateRule();
					(_localctx as AppendDActionContext)._states.push((_localctx as AppendDActionContext)._stateRule);
					}
					}
					this.state = 81;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 82;
				this.match(DParser.END);
				}
				break;
			case DParser.APPEND_EARLY:
				_localctx = new AppendEarlyDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 84;
				this.match(DParser.APPEND_EARLY);
				this.state = 86;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.IF_FILE_EXISTS) {
					{
					this.state = 85;
					(_localctx as AppendEarlyDActionContext)._ifExists = this.match(DParser.IF_FILE_EXISTS);
					}
				}

				this.state = 88;
				(_localctx as AppendEarlyDActionContext)._dlg = this.fileRule();
				this.state = 92;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.APPENDI) | (1 << DParser.CHAIN2))) !== 0)) {
					{
					{
					this.state = 89;
					(_localctx as AppendEarlyDActionContext)._stateRule = this.stateRule();
					(_localctx as AppendEarlyDActionContext)._states.push((_localctx as AppendEarlyDActionContext)._stateRule);
					}
					}
					this.state = 94;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 95;
				this.match(DParser.END);
				}
				break;
			case DParser.CHAIN:
				_localctx = new ChainDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 97;
				this.match(DParser.CHAIN);
				this.state = 106;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.IF) {
					{
					this.state = 98;
					this.match(DParser.IF);
					this.state = 101;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === DParser.WEIGHT) {
						{
						this.state = 99;
						this.match(DParser.WEIGHT);
						this.state = 100;
						(_localctx as ChainDActionContext)._weight = this.sharpNumberRule();
						}
					}

					this.state = 103;
					(_localctx as ChainDActionContext)._trigger = this.stringRule();
					this.state = 104;
					this.match(DParser.THEN);
					}
				}

				this.state = 109;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.IF_FILE_EXISTS) {
					{
					this.state = 108;
					(_localctx as ChainDActionContext)._ifExists = this.match(DParser.IF_FILE_EXISTS);
					}
				}

				this.state = 111;
				(_localctx as ChainDActionContext)._dlg = this.fileRule();
				this.state = 112;
				(_localctx as ChainDActionContext)._label = this.stringRule();
				this.state = 113;
				(_localctx as ChainDActionContext)._body = this.chainDlgRule();
				this.state = 114;
				(_localctx as ChainDActionContext)._epilog = this.chainActionEpilogRule();
				}
				break;
			case DParser.INTERJECT:
				_localctx = new InterjectDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 116;
				this.match(DParser.INTERJECT);
				this.state = 117;
				(_localctx as InterjectDActionContext)._dlg = this.fileRule();
				this.state = 118;
				(_localctx as InterjectDActionContext)._label = this.stringRule();
				this.state = 119;
				(_localctx as InterjectDActionContext)._globalVar = this.stringRule();
				this.state = 123;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.EQEQ || _la === DParser.BRANCH) {
					{
					{
					this.state = 120;
					(_localctx as InterjectDActionContext)._chainBlockRule = this.chainBlockRule();
					(_localctx as InterjectDActionContext)._blocks.push((_localctx as InterjectDActionContext)._chainBlockRule);
					}
					}
					this.state = 125;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 126;
				(_localctx as InterjectDActionContext)._epilog = this.chainActionEpilogRule();
				}
				break;
			case DParser.INTERJECT_COPY_TRANS:
			case DParser.INTERJECT_COPY_TRANS2:
			case DParser.INTERJECT_COPY_TRANS3:
			case DParser.INTERJECT_COPY_TRANS4:
				_localctx = new InterjectCopyTransDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 132;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case DParser.INTERJECT_COPY_TRANS:
					{
					this.state = 128;
					(_localctx as InterjectCopyTransDActionContext)._v1 = this.match(DParser.INTERJECT_COPY_TRANS);
					}
					break;
				case DParser.INTERJECT_COPY_TRANS2:
					{
					this.state = 129;
					(_localctx as InterjectCopyTransDActionContext)._v2 = this.match(DParser.INTERJECT_COPY_TRANS2);
					}
					break;
				case DParser.INTERJECT_COPY_TRANS3:
					{
					this.state = 130;
					(_localctx as InterjectCopyTransDActionContext)._v3 = this.match(DParser.INTERJECT_COPY_TRANS3);
					}
					break;
				case DParser.INTERJECT_COPY_TRANS4:
					{
					this.state = 131;
					(_localctx as InterjectCopyTransDActionContext)._v4 = this.match(DParser.INTERJECT_COPY_TRANS4);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 135;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SAFE) {
					{
					this.state = 134;
					(_localctx as InterjectCopyTransDActionContext)._safe = this.match(DParser.SAFE);
					}
				}

				this.state = 138;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.IF_FILE_EXISTS) {
					{
					this.state = 137;
					(_localctx as InterjectCopyTransDActionContext)._ifExists = this.match(DParser.IF_FILE_EXISTS);
					}
				}

				this.state = 140;
				(_localctx as InterjectCopyTransDActionContext)._dlg = this.fileRule();
				this.state = 141;
				(_localctx as InterjectCopyTransDActionContext)._label = this.stringRule();
				this.state = 142;
				(_localctx as InterjectCopyTransDActionContext)._globalVar = this.stringRule();
				this.state = 146;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.EQEQ || _la === DParser.BRANCH) {
					{
					{
					this.state = 143;
					(_localctx as InterjectCopyTransDActionContext)._chainBlockRule = this.chainBlockRule();
					(_localctx as InterjectCopyTransDActionContext)._blocks.push((_localctx as InterjectCopyTransDActionContext)._chainBlockRule);
					}
					}
					this.state = 148;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 149;
				this.match(DParser.END);
				}
				break;
			case DParser.EXTEND_TOP:
			case DParser.EXTEND_BOTTOM:
				_localctx = new ExtendTopBottomDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 153;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case DParser.EXTEND_TOP:
					{
					this.state = 151;
					(_localctx as ExtendTopBottomDActionContext)._top = this.match(DParser.EXTEND_TOP);
					}
					break;
				case DParser.EXTEND_BOTTOM:
					{
					this.state = 152;
					(_localctx as ExtendTopBottomDActionContext)._bottom = this.match(DParser.EXTEND_BOTTOM);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 155;
				(_localctx as ExtendTopBottomDActionContext)._dlg = this.fileRule();
				this.state = 159;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 156;
					(_localctx as ExtendTopBottomDActionContext)._stringRule = this.stringRule();
					(_localctx as ExtendTopBottomDActionContext)._states.push((_localctx as ExtendTopBottomDActionContext)._stringRule);
					}
					}
					this.state = 161;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 163;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SHARP_NUMBER) {
					{
					this.state = 162;
					(_localctx as ExtendTopBottomDActionContext)._position = this.sharpNumberRule();
					}
				}

				this.state = 168;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.PLUS) | (1 << DParser.COPY_TRANS) | (1 << DParser.COPY_TRANS_LATE))) !== 0)) {
					{
					{
					this.state = 165;
					(_localctx as ExtendTopBottomDActionContext)._transitionRule = this.transitionRule();
					(_localctx as ExtendTopBottomDActionContext)._transitions.push((_localctx as ExtendTopBottomDActionContext)._transitionRule);
					}
					}
					this.state = 170;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 171;
				this.match(DParser.END);
				}
				break;
			case DParser.ADD_STATE_TRIGGER:
				_localctx = new AddStateTriggerDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 173;
				this.match(DParser.ADD_STATE_TRIGGER);
				this.state = 174;
				(_localctx as AddStateTriggerDActionContext)._dlg = this.fileRule();
				this.state = 175;
				(_localctx as AddStateTriggerDActionContext)._stringRule = this.stringRule();
				(_localctx as AddStateTriggerDActionContext)._labels.push((_localctx as AddStateTriggerDActionContext)._stringRule);
				this.state = 176;
				(_localctx as AddStateTriggerDActionContext)._trigger = this.stringRule();
				this.state = 180;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 177;
					(_localctx as AddStateTriggerDActionContext)._stringRule = this.stringRule();
					(_localctx as AddStateTriggerDActionContext)._labels.push((_localctx as AddStateTriggerDActionContext)._stringRule);
					}
					}
					this.state = 182;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 186;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 183;
					(_localctx as AddStateTriggerDActionContext)._conditionRule = this.conditionRule();
					(_localctx as AddStateTriggerDActionContext)._conditions.push((_localctx as AddStateTriggerDActionContext)._conditionRule);
					}
					}
					this.state = 188;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.ADD_TRANS_TRIGGER:
				_localctx = new AddTransTriggerDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 189;
				this.match(DParser.ADD_TRANS_TRIGGER);
				this.state = 190;
				(_localctx as AddTransTriggerDActionContext)._dlg = this.fileRule();
				this.state = 191;
				(_localctx as AddTransTriggerDActionContext)._stringRule = this.stringRule();
				(_localctx as AddTransTriggerDActionContext)._labels.push((_localctx as AddTransTriggerDActionContext)._stringRule);
				this.state = 192;
				(_localctx as AddTransTriggerDActionContext)._trigger = this.stringRule();
				this.state = 196;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 193;
					(_localctx as AddTransTriggerDActionContext)._stringRule = this.stringRule();
					(_localctx as AddTransTriggerDActionContext)._labels.push((_localctx as AddTransTriggerDActionContext)._stringRule);
					}
					}
					this.state = 198;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 206;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.DO) {
					{
					this.state = 199;
					this.match(DParser.DO);
					this.state = 203;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
						{
						{
						this.state = 200;
						(_localctx as AddTransTriggerDActionContext)._stringRule = this.stringRule();
						(_localctx as AddTransTriggerDActionContext)._tras.push((_localctx as AddTransTriggerDActionContext)._stringRule);
						}
						}
						this.state = 205;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
				}

				this.state = 211;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 208;
					(_localctx as AddTransTriggerDActionContext)._conditionRule = this.conditionRule();
					(_localctx as AddTransTriggerDActionContext)._conditions.push((_localctx as AddTransTriggerDActionContext)._conditionRule);
					}
					}
					this.state = 213;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.ADD_TRANS_ACTION:
				_localctx = new AddTransActionDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 214;
				this.match(DParser.ADD_TRANS_ACTION);
				this.state = 215;
				(_localctx as AddTransActionDActionContext)._dlg = this.fileRule();
				this.state = 216;
				this.match(DParser.BEGIN);
				this.state = 220;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 217;
					(_localctx as AddTransActionDActionContext)._stringRule = this.stringRule();
					(_localctx as AddTransActionDActionContext)._labels.push((_localctx as AddTransActionDActionContext)._stringRule);
					}
					}
					this.state = 222;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 223;
				this.match(DParser.END);
				this.state = 224;
				this.match(DParser.BEGIN);
				this.state = 228;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 225;
					(_localctx as AddTransActionDActionContext)._stringRule = this.stringRule();
					(_localctx as AddTransActionDActionContext)._tras.push((_localctx as AddTransActionDActionContext)._stringRule);
					}
					}
					this.state = 230;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 231;
				this.match(DParser.END);
				this.state = 232;
				(_localctx as AddTransActionDActionContext)._action = this.stringRule();
				this.state = 236;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 233;
					(_localctx as AddTransActionDActionContext)._conditionRule = this.conditionRule();
					(_localctx as AddTransActionDActionContext)._conditions.push((_localctx as AddTransActionDActionContext)._conditionRule);
					}
					}
					this.state = 238;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_TRANS_ACTION:
				_localctx = new ReplaceTransActionDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 239;
				this.match(DParser.REPLACE_TRANS_ACTION);
				this.state = 240;
				(_localctx as ReplaceTransActionDActionContext)._dlg = this.fileRule();
				this.state = 241;
				this.match(DParser.BEGIN);
				this.state = 245;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 242;
					(_localctx as ReplaceTransActionDActionContext)._stringRule = this.stringRule();
					(_localctx as ReplaceTransActionDActionContext)._labels.push((_localctx as ReplaceTransActionDActionContext)._stringRule);
					}
					}
					this.state = 247;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 248;
				this.match(DParser.END);
				this.state = 249;
				this.match(DParser.BEGIN);
				this.state = 253;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 250;
					(_localctx as ReplaceTransActionDActionContext)._stringRule = this.stringRule();
					(_localctx as ReplaceTransActionDActionContext)._tras.push((_localctx as ReplaceTransActionDActionContext)._stringRule);
					}
					}
					this.state = 255;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 256;
				this.match(DParser.END);
				this.state = 257;
				(_localctx as ReplaceTransActionDActionContext)._oldText = this.stringRule();
				this.state = 258;
				(_localctx as ReplaceTransActionDActionContext)._newText = this.stringRule();
				this.state = 262;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 259;
					(_localctx as ReplaceTransActionDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceTransActionDActionContext)._conditions.push((_localctx as ReplaceTransActionDActionContext)._conditionRule);
					}
					}
					this.state = 264;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_TRANS_TRIGGER:
				_localctx = new ReplaceTransTriggerDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 265;
				this.match(DParser.REPLACE_TRANS_TRIGGER);
				this.state = 266;
				(_localctx as ReplaceTransTriggerDActionContext)._dlg = this.fileRule();
				this.state = 267;
				this.match(DParser.BEGIN);
				this.state = 271;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 268;
					(_localctx as ReplaceTransTriggerDActionContext)._stringRule = this.stringRule();
					(_localctx as ReplaceTransTriggerDActionContext)._labels.push((_localctx as ReplaceTransTriggerDActionContext)._stringRule);
					}
					}
					this.state = 273;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 274;
				this.match(DParser.END);
				this.state = 275;
				this.match(DParser.BEGIN);
				this.state = 279;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 276;
					(_localctx as ReplaceTransTriggerDActionContext)._stringRule = this.stringRule();
					(_localctx as ReplaceTransTriggerDActionContext)._tras.push((_localctx as ReplaceTransTriggerDActionContext)._stringRule);
					}
					}
					this.state = 281;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 282;
				this.match(DParser.END);
				this.state = 283;
				(_localctx as ReplaceTransTriggerDActionContext)._oldText = this.stringRule();
				this.state = 284;
				(_localctx as ReplaceTransTriggerDActionContext)._newText = this.stringRule();
				this.state = 288;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 285;
					(_localctx as ReplaceTransTriggerDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceTransTriggerDActionContext)._conditions.push((_localctx as ReplaceTransTriggerDActionContext)._conditionRule);
					}
					}
					this.state = 290;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.ALTER_TRANS:
				_localctx = new AlterTransDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 291;
				this.match(DParser.ALTER_TRANS);
				this.state = 292;
				(_localctx as AlterTransDActionContext)._dlg = this.fileRule();
				this.state = 293;
				this.match(DParser.BEGIN);
				this.state = 297;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 294;
					(_localctx as AlterTransDActionContext)._stringRule = this.stringRule();
					(_localctx as AlterTransDActionContext)._labels.push((_localctx as AlterTransDActionContext)._stringRule);
					}
					}
					this.state = 299;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 300;
				this.match(DParser.END);
				this.state = 301;
				this.match(DParser.BEGIN);
				this.state = 305;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 302;
					(_localctx as AlterTransDActionContext)._stringRule = this.stringRule();
					(_localctx as AlterTransDActionContext)._tras.push((_localctx as AlterTransDActionContext)._stringRule);
					}
					}
					this.state = 307;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 308;
				this.match(DParser.END);
				this.state = 309;
				this.match(DParser.BEGIN);
				this.state = 313;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 310;
					(_localctx as AlterTransDActionContext)._alterTransCommand = this.alterTransCommand();
					(_localctx as AlterTransDActionContext)._changes.push((_localctx as AlterTransDActionContext)._alterTransCommand);
					}
					}
					this.state = 315;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 316;
				this.match(DParser.END);
				}
				break;
			case DParser.REPLACE:
				_localctx = new ReplaceDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 318;
				this.match(DParser.REPLACE);
				this.state = 319;
				(_localctx as ReplaceDActionContext)._dlg = this.fileRule();
				this.state = 323;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.APPENDI) | (1 << DParser.CHAIN2))) !== 0)) {
					{
					{
					this.state = 320;
					(_localctx as ReplaceDActionContext)._stateRule = this.stateRule();
					(_localctx as ReplaceDActionContext)._newStates.push((_localctx as ReplaceDActionContext)._stateRule);
					}
					}
					this.state = 325;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 326;
				this.match(DParser.END);
				}
				break;
			case DParser.SET_WEIGHT:
				_localctx = new SetWeightDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 328;
				this.match(DParser.SET_WEIGHT);
				this.state = 329;
				(_localctx as SetWeightDActionContext)._dlg = this.fileRule();
				this.state = 330;
				(_localctx as SetWeightDActionContext)._label = this.stringRule();
				this.state = 331;
				(_localctx as SetWeightDActionContext)._weight = this.sharpNumberRule();
				}
				break;
			case DParser.REPLACE_SAY:
				_localctx = new ReplaceSayDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 333;
				this.match(DParser.REPLACE_SAY);
				this.state = 334;
				(_localctx as ReplaceSayDActionContext)._dlg = this.fileRule();
				this.state = 335;
				(_localctx as ReplaceSayDActionContext)._label = this.stringRule();
				this.state = 336;
				(_localctx as ReplaceSayDActionContext)._newVal = this.sayTextRule();
				}
				break;
			case DParser.REPLACE_STATE_TRIGGER:
				_localctx = new ReplaceStateTriggerDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 338;
				this.match(DParser.REPLACE_STATE_TRIGGER);
				this.state = 339;
				(_localctx as ReplaceStateTriggerDActionContext)._dlg = this.fileRule();
				this.state = 340;
				(_localctx as ReplaceStateTriggerDActionContext)._stringRule = this.stringRule();
				(_localctx as ReplaceStateTriggerDActionContext)._labels.push((_localctx as ReplaceStateTriggerDActionContext)._stringRule);
				this.state = 341;
				(_localctx as ReplaceStateTriggerDActionContext)._trigger = this.stringRule();
				this.state = 345;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 342;
					(_localctx as ReplaceStateTriggerDActionContext)._stringRule = this.stringRule();
					(_localctx as ReplaceStateTriggerDActionContext)._labels.push((_localctx as ReplaceStateTriggerDActionContext)._stringRule);
					}
					}
					this.state = 347;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 351;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 348;
					(_localctx as ReplaceStateTriggerDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceStateTriggerDActionContext)._conditions.push((_localctx as ReplaceStateTriggerDActionContext)._conditionRule);
					}
					}
					this.state = 353;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_TRIGGER_TEXT:
				_localctx = new ReplaceTriggerTextDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 18);
				{
				this.state = 354;
				this.match(DParser.REPLACE_TRIGGER_TEXT);
				this.state = 355;
				(_localctx as ReplaceTriggerTextDActionContext)._dlg = this.fileRule();
				this.state = 356;
				(_localctx as ReplaceTriggerTextDActionContext)._oldText = this.stringRule();
				this.state = 357;
				(_localctx as ReplaceTriggerTextDActionContext)._newText = this.stringRule();
				this.state = 361;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 358;
					(_localctx as ReplaceTriggerTextDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceTriggerTextDActionContext)._conditions.push((_localctx as ReplaceTriggerTextDActionContext)._conditionRule);
					}
					}
					this.state = 363;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_TRIGGER_TEXT_REGEXP:
				_localctx = new ReplaceTriggerTextRegexpDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 19);
				{
				this.state = 364;
				this.match(DParser.REPLACE_TRIGGER_TEXT_REGEXP);
				this.state = 365;
				(_localctx as ReplaceTriggerTextRegexpDActionContext)._dlgRegexp = this.stringRule();
				this.state = 366;
				(_localctx as ReplaceTriggerTextRegexpDActionContext)._oldText = this.stringRule();
				this.state = 367;
				(_localctx as ReplaceTriggerTextRegexpDActionContext)._newText = this.stringRule();
				this.state = 371;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 368;
					(_localctx as ReplaceTriggerTextRegexpDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceTriggerTextRegexpDActionContext)._conditions.push((_localctx as ReplaceTriggerTextRegexpDActionContext)._conditionRule);
					}
					}
					this.state = 373;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_ACTION_TEXT:
				_localctx = new ReplaceActionTextDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 20);
				{
				this.state = 374;
				this.match(DParser.REPLACE_ACTION_TEXT);
				this.state = 375;
				(_localctx as ReplaceActionTextDActionContext)._fileRule = this.fileRule();
				(_localctx as ReplaceActionTextDActionContext)._dlgs.push((_localctx as ReplaceActionTextDActionContext)._fileRule);
				this.state = 376;
				(_localctx as ReplaceActionTextDActionContext)._oldText = this.stringRule();
				this.state = 377;
				(_localctx as ReplaceActionTextDActionContext)._newText = this.stringRule();
				this.state = 381;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 378;
					(_localctx as ReplaceActionTextDActionContext)._fileRule = this.fileRule();
					(_localctx as ReplaceActionTextDActionContext)._dlgs.push((_localctx as ReplaceActionTextDActionContext)._fileRule);
					}
					}
					this.state = 383;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 387;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 384;
					(_localctx as ReplaceActionTextDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceActionTextDActionContext)._conditions.push((_localctx as ReplaceActionTextDActionContext)._conditionRule);
					}
					}
					this.state = 389;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_ACTION_TEXT_REGEXP:
				_localctx = new ReplaceActionTextRegexpDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 21);
				{
				this.state = 390;
				this.match(DParser.REPLACE_ACTION_TEXT_REGEXP);
				this.state = 391;
				(_localctx as ReplaceActionTextRegexpDActionContext)._stringRule = this.stringRule();
				(_localctx as ReplaceActionTextRegexpDActionContext)._dlgRegexps.push((_localctx as ReplaceActionTextRegexpDActionContext)._stringRule);
				this.state = 392;
				(_localctx as ReplaceActionTextRegexpDActionContext)._oldText = this.stringRule();
				this.state = 393;
				(_localctx as ReplaceActionTextRegexpDActionContext)._newText = this.stringRule();
				this.state = 397;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 394;
					(_localctx as ReplaceActionTextRegexpDActionContext)._stringRule = this.stringRule();
					(_localctx as ReplaceActionTextRegexpDActionContext)._dlgRegexps.push((_localctx as ReplaceActionTextRegexpDActionContext)._stringRule);
					}
					}
					this.state = 399;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 403;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 400;
					(_localctx as ReplaceActionTextRegexpDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceActionTextRegexpDActionContext)._conditions.push((_localctx as ReplaceActionTextRegexpDActionContext)._conditionRule);
					}
					}
					this.state = 405;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_ACTION_TEXT_PROCESS:
				_localctx = new ReplaceActionTextProcessDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 22);
				{
				this.state = 406;
				this.match(DParser.REPLACE_ACTION_TEXT_PROCESS);
				this.state = 407;
				(_localctx as ReplaceActionTextProcessDActionContext)._fileRule = this.fileRule();
				(_localctx as ReplaceActionTextProcessDActionContext)._dlgs.push((_localctx as ReplaceActionTextProcessDActionContext)._fileRule);
				this.state = 408;
				(_localctx as ReplaceActionTextProcessDActionContext)._oldText = this.stringRule();
				this.state = 409;
				(_localctx as ReplaceActionTextProcessDActionContext)._newText = this.stringRule();
				this.state = 413;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 410;
					(_localctx as ReplaceActionTextProcessDActionContext)._fileRule = this.fileRule();
					(_localctx as ReplaceActionTextProcessDActionContext)._dlgs.push((_localctx as ReplaceActionTextProcessDActionContext)._fileRule);
					}
					}
					this.state = 415;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 419;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 416;
					(_localctx as ReplaceActionTextProcessDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceActionTextProcessDActionContext)._conditions.push((_localctx as ReplaceActionTextProcessDActionContext)._conditionRule);
					}
					}
					this.state = 421;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.REPLACE_ACTION_TEXT_PROCESS_REGEXP:
				_localctx = new ReplaceActionTextProcessRegexpDActionContext(_localctx);
				this.enterOuterAlt(_localctx, 23);
				{
				this.state = 422;
				this.match(DParser.REPLACE_ACTION_TEXT_PROCESS_REGEXP);
				this.state = 423;
				(_localctx as ReplaceActionTextProcessRegexpDActionContext)._stringRule = this.stringRule();
				(_localctx as ReplaceActionTextProcessRegexpDActionContext)._dlgRegexps.push((_localctx as ReplaceActionTextProcessRegexpDActionContext)._stringRule);
				this.state = 424;
				(_localctx as ReplaceActionTextProcessRegexpDActionContext)._oldText = this.stringRule();
				this.state = 425;
				(_localctx as ReplaceActionTextProcessRegexpDActionContext)._newText = this.stringRule();
				this.state = 429;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					{
					this.state = 426;
					(_localctx as ReplaceActionTextProcessRegexpDActionContext)._stringRule = this.stringRule();
					(_localctx as ReplaceActionTextProcessRegexpDActionContext)._dlgRegexps.push((_localctx as ReplaceActionTextProcessRegexpDActionContext)._stringRule);
					}
					}
					this.state = 431;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 435;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.IF || _la === DParser.UNLESS) {
					{
					{
					this.state = 432;
					(_localctx as ReplaceActionTextProcessRegexpDActionContext)._conditionRule = this.conditionRule();
					(_localctx as ReplaceActionTextProcessRegexpDActionContext)._conditions.push((_localctx as ReplaceActionTextProcessRegexpDActionContext)._conditionRule);
					}
					}
					this.state = 437;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public alterTransCommand(): AlterTransCommandContext {
		let _localctx: AlterTransCommandContext = new AlterTransCommandContext(this._ctx, this.state);
		this.enterRule(_localctx, 6, DParser.RULE_alterTransCommand);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 440;
			_localctx._type = this.stringRule();
			this.state = 441;
			_localctx._newVal = this.stringRule();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public conditionRule(): ConditionRuleContext {
		let _localctx: ConditionRuleContext = new ConditionRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 8, DParser.RULE_conditionRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 445;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.IF:
				{
				this.state = 443;
				_localctx._isIf = this.match(DParser.IF);
				}
				break;
			case DParser.UNLESS:
				{
				this.state = 444;
				_localctx._isUnless = this.match(DParser.UNLESS);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 447;
			_localctx._predicate = this.stringRule();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public stateRule(): StateRuleContext {
		let _localctx: StateRuleContext = new StateRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 10, DParser.RULE_stateRule);
		let _la: number;
		try {
			this.state = 497;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.IF:
				_localctx = new IfThenStateContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 449;
				this.match(DParser.IF);
				this.state = 452;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.WEIGHT) {
					{
					this.state = 450;
					this.match(DParser.WEIGHT);
					this.state = 451;
					(_localctx as IfThenStateContext)._weight = this.sharpNumberRule();
					}
				}

				this.state = 454;
				(_localctx as IfThenStateContext)._trigger = this.stringRule();
				this.state = 456;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.THEN) {
					{
					this.state = 455;
					this.match(DParser.THEN);
					}
				}

				this.state = 459;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.BEGIN) {
					{
					this.state = 458;
					this.match(DParser.BEGIN);
					}
				}

				this.state = 461;
				(_localctx as IfThenStateContext)._label = this.stringRule();
				this.state = 462;
				this.match(DParser.SAY);
				this.state = 463;
				(_localctx as IfThenStateContext)._sayTextRule = this.sayTextRule();
				(_localctx as IfThenStateContext)._lines.push((_localctx as IfThenStateContext)._sayTextRule);
				this.state = 468;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.EQ) {
					{
					{
					this.state = 464;
					this.match(DParser.EQ);
					this.state = 465;
					(_localctx as IfThenStateContext)._sayTextRule = this.sayTextRule();
					(_localctx as IfThenStateContext)._lines.push((_localctx as IfThenStateContext)._sayTextRule);
					}
					}
					this.state = 470;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 474;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.PLUS) | (1 << DParser.COPY_TRANS) | (1 << DParser.COPY_TRANS_LATE))) !== 0)) {
					{
					{
					this.state = 471;
					(_localctx as IfThenStateContext)._transitionRule = this.transitionRule();
					(_localctx as IfThenStateContext)._transitions.push((_localctx as IfThenStateContext)._transitionRule);
					}
					}
					this.state = 476;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 477;
				this.match(DParser.END);
				}
				break;
			case DParser.APPENDI:
				_localctx = new AppendiStateContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 479;
				this.match(DParser.APPENDI);
				this.state = 480;
				(_localctx as AppendiStateContext)._dlg = this.fileRule();
				this.state = 484;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.APPENDI) | (1 << DParser.CHAIN2))) !== 0)) {
					{
					{
					this.state = 481;
					(_localctx as AppendiStateContext)._stateRule = this.stateRule();
					(_localctx as AppendiStateContext)._states.push((_localctx as AppendiStateContext)._stateRule);
					}
					}
					this.state = 486;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 487;
				this.match(DParser.END);
				}
				break;
			case DParser.CHAIN2:
				_localctx = new Chain2StateContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 489;
				this.match(DParser.CHAIN2);
				this.state = 490;
				(_localctx as Chain2StateContext)._dlg = this.fileRule();
				this.state = 491;
				(_localctx as Chain2StateContext)._entryLabel = this.stringRule();
				this.state = 492;
				(_localctx as Chain2StateContext)._body = this.chain2DlgRule();
				this.state = 493;
				this.match(DParser.END);
				this.state = 494;
				(_localctx as Chain2StateContext)._exitDlg = this.fileRule();
				this.state = 495;
				(_localctx as Chain2StateContext)._exitLabel = this.stringRule();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public chain2DlgRule(): Chain2DlgRuleContext {
		let _localctx: Chain2DlgRuleContext = new Chain2DlgRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 12, DParser.RULE_chain2DlgRule);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 499;
			_localctx._initialLine = this.chainElementRule();
			this.state = 503;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === DParser.EQ || _la === DParser.EQEQ) {
				{
				{
				this.state = 500;
				_localctx._chain2ElementRule = this.chain2ElementRule();
				_localctx._restLines.push(_localctx._chain2ElementRule);
				}
				}
				this.state = 505;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public chain2ElementRule(): Chain2ElementRuleContext {
		let _localctx: Chain2ElementRuleContext = new Chain2ElementRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 14, DParser.RULE_chain2ElementRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 508;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.EQEQ:
				{
				this.state = 506;
				_localctx._operator = this.match(DParser.EQEQ);
				}
				break;
			case DParser.EQ:
				{
				this.state = 507;
				_localctx._operator = this.match(DParser.EQ);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 510;
			_localctx._line = this.chainElementRule();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public transitionRule(): TransitionRuleContext {
		let _localctx: TransitionRuleContext = new TransitionRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 16, DParser.RULE_transitionRule);
		let _la: number;
		try {
			this.state = 553;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.IF:
				_localctx = new IfThenTransitionContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 512;
				this.match(DParser.IF);
				this.state = 513;
				(_localctx as IfThenTransitionContext)._trigger = this.stringRule();
				this.state = 515;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.THEN) {
					{
					this.state = 514;
					this.match(DParser.THEN);
					}
				}

				this.state = 520;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.DO) | (1 << DParser.JOURNAL) | (1 << DParser.SOLVED_JOURNAL) | (1 << DParser.UNSOLVED_JOURNAL) | (1 << DParser.FLAGS) | (1 << DParser.REPLY))) !== 0)) {
					{
					{
					this.state = 517;
					(_localctx as IfThenTransitionContext)._transitionFeatureRule = this.transitionFeatureRule();
					(_localctx as IfThenTransitionContext)._features.push((_localctx as IfThenTransitionContext)._transitionFeatureRule);
					}
					}
					this.state = 522;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 523;
				(_localctx as IfThenTransitionContext)._transitionTargetRule = this.transitionTargetRule();
				(_localctx as IfThenTransitionContext)._out.push((_localctx as IfThenTransitionContext)._transitionTargetRule);
				}
				break;
			case DParser.PLUS:
				_localctx = new ReplyTransitionContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 525;
				this.match(DParser.PLUS);
				this.state = 527;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (DParser.TILDE_STRING - 60)) | (1 << (DParser.QUOTE_STRING - 60)) | (1 << (DParser.PERCENT_STRING - 60)) | (1 << (DParser.IDENTIFIER - 60)) | (1 << (DParser.LONG_TILDE_STRING - 60)))) !== 0)) {
					{
					this.state = 526;
					(_localctx as ReplyTransitionContext)._trigger = this.stringRule();
					}
				}

				this.state = 529;
				this.match(DParser.PLUS);
				this.state = 530;
				(_localctx as ReplyTransitionContext)._reply = this.sayTextRule();
				this.state = 534;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.DO) | (1 << DParser.JOURNAL) | (1 << DParser.SOLVED_JOURNAL) | (1 << DParser.UNSOLVED_JOURNAL) | (1 << DParser.FLAGS) | (1 << DParser.REPLY))) !== 0)) {
					{
					{
					this.state = 531;
					(_localctx as ReplyTransitionContext)._transitionFeatureRule = this.transitionFeatureRule();
					(_localctx as ReplyTransitionContext)._features.push((_localctx as ReplyTransitionContext)._transitionFeatureRule);
					}
					}
					this.state = 536;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 537;
				(_localctx as ReplyTransitionContext)._transitionTargetRule = this.transitionTargetRule();
				(_localctx as ReplyTransitionContext)._out.push((_localctx as ReplyTransitionContext)._transitionTargetRule);
				}
				break;
			case DParser.COPY_TRANS:
				_localctx = new CopyTransTransitionContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 539;
				this.match(DParser.COPY_TRANS);
				this.state = 541;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SAFE) {
					{
					this.state = 540;
					(_localctx as CopyTransTransitionContext)._safe = this.match(DParser.SAFE);
					}
				}

				this.state = 543;
				(_localctx as CopyTransTransitionContext)._dlg = this.fileRule();
				this.state = 544;
				(_localctx as CopyTransTransitionContext)._label = this.stringRule();
				}
				break;
			case DParser.COPY_TRANS_LATE:
				_localctx = new CopyTransLateTransitionContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 546;
				this.match(DParser.COPY_TRANS_LATE);
				this.state = 548;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SAFE) {
					{
					this.state = 547;
					(_localctx as CopyTransLateTransitionContext)._safe = this.match(DParser.SAFE);
					}
				}

				this.state = 550;
				(_localctx as CopyTransLateTransitionContext)._dlg = this.fileRule();
				this.state = 551;
				(_localctx as CopyTransLateTransitionContext)._label = this.stringRule();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public transitionTargetRule(): TransitionTargetRuleContext {
		let _localctx: TransitionTargetRuleContext = new TransitionTargetRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 18, DParser.RULE_transitionTargetRule);
		let _la: number;
		try {
			this.state = 565;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.PLUS:
			case DParser.GOTO:
				_localctx = new GotoTransitionTargetContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 555;
				_la = this._input.LA(1);
				if (!(_la === DParser.PLUS || _la === DParser.GOTO)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 556;
				(_localctx as GotoTransitionTargetContext)._label = this.stringRule();
				}
				break;
			case DParser.EXTERN:
				_localctx = new ExternTransitionTargetContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 557;
				this.match(DParser.EXTERN);
				this.state = 559;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.IF_FILE_EXISTS) {
					{
					this.state = 558;
					(_localctx as ExternTransitionTargetContext)._ifExists = this.match(DParser.IF_FILE_EXISTS);
					}
				}

				this.state = 561;
				(_localctx as ExternTransitionTargetContext)._dlg = this.fileRule();
				this.state = 562;
				(_localctx as ExternTransitionTargetContext)._label = this.stringRule();
				}
				break;
			case DParser.EXIT:
				_localctx = new ExitTransitionTargetContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 564;
				this.match(DParser.EXIT);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public chainActionEpilogRule(): ChainActionEpilogRuleContext {
		let _localctx: ChainActionEpilogRuleContext = new ChainActionEpilogRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 20, DParser.RULE_chainActionEpilogRule);
		let _la: number;
		try {
			this.state = 597;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 73, this._ctx) ) {
			case 1:
				_localctx = new EndChainActionEpilogContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 567;
				this.match(DParser.END);
				this.state = 568;
				(_localctx as EndChainActionEpilogContext)._dlg = this.fileRule();
				this.state = 569;
				(_localctx as EndChainActionEpilogContext)._label = this.stringRule();
				}
				break;

			case 2:
				_localctx = new ExternChainActionEpilogContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 571;
				this.match(DParser.EXTERN);
				this.state = 572;
				(_localctx as ExternChainActionEpilogContext)._dlg = this.fileRule();
				this.state = 573;
				(_localctx as ExternChainActionEpilogContext)._label = this.stringRule();
				}
				break;

			case 3:
				_localctx = new CopyTransChainActionEpilogContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 575;
				this.match(DParser.COPY_TRANS);
				this.state = 577;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SAFE) {
					{
					this.state = 576;
					(_localctx as CopyTransChainActionEpilogContext)._safe = this.match(DParser.SAFE);
					}
				}

				this.state = 579;
				(_localctx as CopyTransChainActionEpilogContext)._dlg = this.fileRule();
				this.state = 580;
				(_localctx as CopyTransChainActionEpilogContext)._label = this.stringRule();
				}
				break;

			case 4:
				_localctx = new CopyTransLateChainActionEpilogContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 582;
				this.match(DParser.COPY_TRANS_LATE);
				this.state = 584;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SAFE) {
					{
					this.state = 583;
					(_localctx as CopyTransLateChainActionEpilogContext)._safe = this.match(DParser.SAFE);
					}
				}

				this.state = 586;
				(_localctx as CopyTransLateChainActionEpilogContext)._dlg = this.fileRule();
				this.state = 587;
				(_localctx as CopyTransLateChainActionEpilogContext)._label = this.stringRule();
				}
				break;

			case 5:
				_localctx = new ExitChainActionEpilogContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 589;
				this.match(DParser.EXIT);
				}
				break;

			case 6:
				_localctx = new EndWithTransitionsChainActionEpilogContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 590;
				this.match(DParser.END);
				this.state = 594;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << DParser.IF) | (1 << DParser.PLUS) | (1 << DParser.COPY_TRANS) | (1 << DParser.COPY_TRANS_LATE))) !== 0)) {
					{
					{
					this.state = 591;
					(_localctx as EndWithTransitionsChainActionEpilogContext)._transitionRule = this.transitionRule();
					(_localctx as EndWithTransitionsChainActionEpilogContext)._transitions.push((_localctx as EndWithTransitionsChainActionEpilogContext)._transitionRule);
					}
					}
					this.state = 596;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public transitionFeatureRule(): TransitionFeatureRuleContext {
		let _localctx: TransitionFeatureRuleContext = new TransitionFeatureRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 22, DParser.RULE_transitionFeatureRule);
		try {
			this.state = 611;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.REPLY:
				_localctx = new ReplyTransitionFeatureContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 599;
				this.match(DParser.REPLY);
				this.state = 600;
				(_localctx as ReplyTransitionFeatureContext)._line = this.dlgLineRule();
				}
				break;
			case DParser.DO:
				_localctx = new DoTransitionFeatureContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 601;
				this.match(DParser.DO);
				this.state = 602;
				(_localctx as DoTransitionFeatureContext)._action = this.stringRule();
				}
				break;
			case DParser.JOURNAL:
				_localctx = new JournalTransitionFeatureContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 603;
				this.match(DParser.JOURNAL);
				this.state = 604;
				(_localctx as JournalTransitionFeatureContext)._entry = this.dlgLineRule();
				}
				break;
			case DParser.SOLVED_JOURNAL:
				_localctx = new SolvedJournalTransitionFeatureContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 605;
				this.match(DParser.SOLVED_JOURNAL);
				this.state = 606;
				(_localctx as SolvedJournalTransitionFeatureContext)._entry = this.dlgLineRule();
				}
				break;
			case DParser.UNSOLVED_JOURNAL:
				_localctx = new UnsolvedJournalTransitionFeatureContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 607;
				this.match(DParser.UNSOLVED_JOURNAL);
				this.state = 608;
				(_localctx as UnsolvedJournalTransitionFeatureContext)._entry = this.dlgLineRule();
				}
				break;
			case DParser.FLAGS:
				_localctx = new FlagsTransitionFeatureContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 609;
				this.match(DParser.FLAGS);
				this.state = 610;
				(_localctx as FlagsTransitionFeatureContext)._flags = this.stringRule();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public chainDlgRule(): ChainDlgRuleContext {
		let _localctx: ChainDlgRuleContext = new ChainDlgRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 24, DParser.RULE_chainDlgRule);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 617;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 75, this._ctx) ) {
			case 1:
				{
				this.state = 613;
				this.match(DParser.IF);
				this.state = 614;
				_localctx._trigger = this.stringRule();
				this.state = 615;
				this.match(DParser.THEN);
				}
				break;
			}
			this.state = 619;
			_localctx._chainElementRule = this.chainElementRule();
			_localctx._initialSpeakerLines.push(_localctx._chainElementRule);
			this.state = 624;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === DParser.EQ) {
				{
				{
				this.state = 620;
				this.match(DParser.EQ);
				this.state = 621;
				_localctx._chainElementRule = this.chainElementRule();
				_localctx._initialSpeakerLines.push(_localctx._chainElementRule);
				}
				}
				this.state = 626;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 630;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === DParser.EQEQ || _la === DParser.BRANCH) {
				{
				{
				this.state = 627;
				_localctx._chainBlockRule = this.chainBlockRule();
				_localctx._blocks.push(_localctx._chainBlockRule);
				}
				}
				this.state = 632;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public chainBlockRule(): ChainBlockRuleContext {
		let _localctx: ChainBlockRuleContext = new ChainBlockRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 26, DParser.RULE_chainBlockRule);
		let _la: number;
		try {
			this.state = 657;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.EQEQ:
				_localctx = new MonologChainBlockContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 633;
				this.match(DParser.EQEQ);
				this.state = 635;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.IF_FILE_EXISTS) {
					{
					this.state = 634;
					(_localctx as MonologChainBlockContext)._ifExists = this.match(DParser.IF_FILE_EXISTS);
					}
				}

				this.state = 637;
				(_localctx as MonologChainBlockContext)._dlg = this.fileRule();
				this.state = 638;
				(_localctx as MonologChainBlockContext)._chainElementRule = this.chainElementRule();
				(_localctx as MonologChainBlockContext)._elements.push((_localctx as MonologChainBlockContext)._chainElementRule);
				this.state = 643;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.EQ) {
					{
					{
					this.state = 639;
					this.match(DParser.EQ);
					this.state = 640;
					(_localctx as MonologChainBlockContext)._chainElementRule = this.chainElementRule();
					(_localctx as MonologChainBlockContext)._elements.push((_localctx as MonologChainBlockContext)._chainElementRule);
					}
					}
					this.state = 645;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case DParser.BRANCH:
				_localctx = new BranchChainBlockContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 646;
				this.match(DParser.BRANCH);
				this.state = 647;
				(_localctx as BranchChainBlockContext)._trigger = this.stringRule();
				this.state = 648;
				this.match(DParser.BEGIN);
				this.state = 652;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === DParser.EQEQ || _la === DParser.BRANCH) {
					{
					{
					this.state = 649;
					(_localctx as BranchChainBlockContext)._chainBlockRule = this.chainBlockRule();
					(_localctx as BranchChainBlockContext)._blocks.push((_localctx as BranchChainBlockContext)._chainBlockRule);
					}
					}
					this.state = 654;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 655;
				this.match(DParser.END);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public chainElementRule(): ChainElementRuleContext {
		let _localctx: ChainElementRuleContext = new ChainElementRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 28, DParser.RULE_chainElementRule);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 664;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === DParser.IF) {
				{
				this.state = 659;
				this.match(DParser.IF);
				this.state = 660;
				_localctx._trigger = this.stringRule();
				this.state = 662;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.THEN) {
					{
					this.state = 661;
					this.match(DParser.THEN);
					}
				}

				}
			}

			this.state = 666;
			_localctx._line = this.sayTextRule();
			this.state = 669;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === DParser.DO) {
				{
				this.state = 667;
				this.match(DParser.DO);
				this.state = 668;
				_localctx._action = this.stringRule();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fileRule(): FileRuleContext {
		let _localctx: FileRuleContext = new FileRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 30, DParser.RULE_fileRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 671;
			this.stringRule();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sayTextRule(): SayTextRuleContext {
		let _localctx: SayTextRuleContext = new SayTextRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 32, DParser.RULE_sayTextRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 673;
			this.dlgLineRule();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public traLineRule(): TraLineRuleContext {
		let _localctx: TraLineRuleContext = new TraLineRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 34, DParser.RULE_traLineRule);
		try {
			this.state = 678;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 85, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 675;
				_localctx._string = this.stringRule();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 676;
				_localctx._ref = this.referenceRule();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 677;
				_localctx._dlgLine = this.dlgLineRule();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public dlgLineRule(): DlgLineRuleContext {
		let _localctx: DlgLineRuleContext = new DlgLineRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 36, DParser.RULE_dlgLineRule);
		let _la: number;
		try {
			this.state = 693;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 89, this._ctx) ) {
			case 1:
				_localctx = new GenderedTextContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 680;
				(_localctx as GenderedTextContext)._maleLine = this.stringRule();
				this.state = 682;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SOUND_STRING) {
					{
					this.state = 681;
					(_localctx as GenderedTextContext)._maleSound = this.soundRule();
					}
				}

				this.state = 684;
				(_localctx as GenderedTextContext)._femaleLine = this.stringRule();
				this.state = 686;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SOUND_STRING) {
					{
					this.state = 685;
					(_localctx as GenderedTextContext)._femaleSound = this.soundRule();
					}
				}

				}
				break;

			case 2:
				_localctx = new GenderNeutralTextContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 688;
				(_localctx as GenderNeutralTextContext)._line = this.stringRule();
				this.state = 690;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === DParser.SOUND_STRING) {
					{
					this.state = 689;
					(_localctx as GenderNeutralTextContext)._sound = this.soundRule();
					}
				}

				}
				break;

			case 3:
				_localctx = new ReferencedTextContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 692;
				this.referenceRule();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public stringRule(): StringRuleContext {
		let _localctx: StringRuleContext = new StringRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 38, DParser.RULE_stringRule);
		let _la: number;
		try {
			this.state = 703;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 91, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 695;
				this.stringLiteralRule();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 696;
				_localctx._stringLiteralRule = this.stringLiteralRule();
				_localctx._parts.push(_localctx._stringLiteralRule);
				this.state = 699;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 697;
					this.match(DParser.CONCAT);
					this.state = 698;
					_localctx._stringLiteralRule = this.stringLiteralRule();
					_localctx._parts.push(_localctx._stringLiteralRule);
					}
					}
					this.state = 701;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la === DParser.CONCAT);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public stringLiteralRule(): StringLiteralRuleContext {
		let _localctx: StringLiteralRuleContext = new StringLiteralRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 40, DParser.RULE_stringLiteralRule);
		try {
			this.state = 710;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.IDENTIFIER:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 705;
				this.identifierRule();
				}
				break;
			case DParser.PERCENT_STRING:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 706;
				this.match(DParser.PERCENT_STRING);
				}
				break;
			case DParser.TILDE_STRING:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 707;
				this.match(DParser.TILDE_STRING);
				}
				break;
			case DParser.LONG_TILDE_STRING:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 708;
				this.match(DParser.LONG_TILDE_STRING);
				}
				break;
			case DParser.QUOTE_STRING:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 709;
				this.match(DParser.QUOTE_STRING);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public identifierRule(): IdentifierRuleContext {
		let _localctx: IdentifierRuleContext = new IdentifierRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 42, DParser.RULE_identifierRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 712;
			this.match(DParser.IDENTIFIER);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public referenceRule(): ReferenceRuleContext {
		let _localctx: ReferenceRuleContext = new ReferenceRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 44, DParser.RULE_referenceRule);
		try {
			this.state = 722;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case DParser.SHARP_NUMBER:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 714;
				this.match(DParser.SHARP_NUMBER);
				}
				break;
			case DParser.FORCED_STRING_REFERENCE:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 715;
				this.match(DParser.FORCED_STRING_REFERENCE);
				}
				break;
			case DParser.TRANSLATION_REFERENCE:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 716;
				this.match(DParser.TRANSLATION_REFERENCE);
				}
				break;
			case DParser.PAREN_OPEN:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 717;
				this.match(DParser.PAREN_OPEN);
				this.state = 718;
				this.match(DParser.AT);
				this.state = 719;
				this.stringRule();
				this.state = 720;
				this.match(DParser.PAREN_CLOSE);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sharpNumberRule(): SharpNumberRuleContext {
		let _localctx: SharpNumberRuleContext = new SharpNumberRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 46, DParser.RULE_sharpNumberRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 724;
			this.match(DParser.SHARP_NUMBER);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public soundRule(): SoundRuleContext {
		let _localctx: SoundRuleContext = new SoundRuleContext(this._ctx, this.state);
		this.enterRule(_localctx, 48, DParser.RULE_soundRule);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 726;
			this.match(DParser.SOUND_STRING);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	private static readonly _serializedATNSegments: number = 2;
	private static readonly _serializedATNSegment0: string =
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03K\u02DB\x04\x02" +
		"\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
		"\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
		"\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
		"\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
		"\x18\t\x18\x04\x19\t\x19\x04\x1A\t\x1A\x03\x02\x03\x02\x03\x03\x07\x03" +
		"8\n\x03\f\x03\x0E\x03;\v\x03\x03\x03\x03\x03\x03\x04\x03\x04\x03\x04\x05" +
		"\x04B\n\x04\x03\x04\x07\x04E\n\x04\f\x04\x0E\x04H\v\x04\x03\x04\x03\x04" +
		"\x05\x04L\n\x04\x03\x04\x03\x04\x07\x04P\n\x04\f\x04\x0E\x04S\v\x04\x03" +
		"\x04\x03\x04\x03\x04\x03\x04\x05\x04Y\n\x04\x03\x04\x03\x04\x07\x04]\n" +
		"\x04\f\x04\x0E\x04`\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03" +
		"\x04\x05\x04h\n\x04\x03\x04\x03\x04\x03\x04\x05\x04m\n\x04\x03\x04\x05" +
		"\x04p\n\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03" +
		"\x04\x03\x04\x03\x04\x07\x04|\n\x04\f\x04\x0E\x04\x7F\v\x04\x03\x04\x03" +
		"\x04\x03\x04\x03\x04\x03\x04\x03\x04\x05\x04\x87\n\x04\x03\x04\x05\x04" +
		"\x8A\n\x04\x03\x04\x05\x04\x8D\n\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07" +
		"\x04\x93\n\x04\f\x04\x0E\x04\x96\v\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x05\x04\x9C\n\x04\x03\x04\x03\x04\x07\x04\xA0\n\x04\f\x04\x0E\x04\xA3" +
		"\v\x04\x03\x04\x05\x04\xA6\n\x04\x03\x04\x07\x04\xA9\n\x04\f\x04\x0E\x04" +
		"\xAC\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07" +
		"\x04\xB5\n\x04\f\x04\x0E\x04\xB8\v\x04\x03\x04\x07\x04\xBB\n\x04\f\x04" +
		"\x0E\x04\xBE\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\xC5" +
		"\n\x04\f\x04\x0E\x04\xC8\v\x04\x03\x04\x03\x04\x07\x04\xCC\n\x04\f\x04" +
		"\x0E\x04\xCF\v\x04\x05\x04\xD1\n\x04\x03\x04\x07\x04\xD4\n\x04\f\x04\x0E" +
		"\x04\xD7\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\xDD\n\x04\f\x04" +
		"\x0E\x04\xE0\v\x04\x03\x04\x03\x04\x03\x04\x07\x04\xE5\n\x04\f\x04\x0E" +
		"\x04\xE8\v\x04\x03\x04\x03\x04\x03\x04\x07\x04\xED\n\x04\f\x04\x0E\x04" +
		"\xF0\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\xF6\n\x04\f\x04\x0E" +
		"\x04\xF9\v\x04\x03\x04\x03\x04\x03\x04\x07\x04\xFE\n\x04\f\x04\x0E\x04" +
		"\u0101\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\u0107\n\x04\f\x04" +
		"\x0E\x04\u010A\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\u0110\n\x04" +
		"\f\x04\x0E\x04\u0113\v\x04\x03\x04\x03\x04\x03\x04\x07\x04\u0118\n\x04" +
		"\f\x04\x0E\x04\u011B\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\u0121" +
		"\n\x04\f\x04\x0E\x04\u0124\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04" +
		"\u012A\n\x04\f\x04\x0E\x04\u012D\v\x04\x03\x04\x03\x04\x03\x04\x07\x04" +
		"\u0132\n\x04\f\x04\x0E\x04\u0135\v\x04\x03\x04\x03\x04\x03\x04\x07\x04" +
		"\u013A\n\x04\f\x04\x0E\x04\u013D\v\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x03\x04\x07\x04\u0144\n\x04\f\x04\x0E\x04\u0147\v\x04\x03\x04\x03\x04" +
		"\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\u015A\n\x04\f" +
		"\x04\x0E\x04\u015D\v\x04\x03\x04\x07\x04\u0160\n\x04\f\x04\x0E\x04\u0163" +
		"\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\u016A\n\x04\f\x04" +
		"\x0E\x04\u016D\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x07\x04\u0174" +
		"\n\x04\f\x04\x0E\x04\u0177\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x07\x04\u017E\n\x04\f\x04\x0E\x04\u0181\v\x04\x03\x04\x07\x04\u0184\n" +
		"\x04\f\x04\x0E\x04\u0187\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x07\x04\u018E\n\x04\f\x04\x0E\x04\u0191\v\x04\x03\x04\x07\x04\u0194\n" +
		"\x04\f\x04\x0E\x04\u0197\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x07\x04\u019E\n\x04\f\x04\x0E\x04\u01A1\v\x04\x03\x04\x07\x04\u01A4\n" +
		"\x04\f\x04\x0E\x04\u01A7\v\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04" +
		"\x07\x04\u01AE\n\x04\f\x04\x0E\x04\u01B1\v\x04\x03\x04\x07\x04\u01B4\n" +
		"\x04\f\x04\x0E\x04\u01B7\v\x04\x05\x04\u01B9\n\x04\x03\x05\x03\x05\x03" +
		"\x05\x03\x06\x03\x06\x05\x06\u01C0\n\x06\x03\x06\x03\x06\x03\x07\x03\x07" +
		"\x03\x07\x05\x07\u01C7\n\x07\x03\x07\x03\x07\x05\x07\u01CB\n\x07\x03\x07" +
		"\x05\x07\u01CE\n\x07\x03\x07\x03\x07\x03\x07\x03\x07\x03\x07\x07\x07\u01D5" +
		"\n\x07\f\x07\x0E\x07\u01D8\v\x07\x03\x07\x07\x07\u01DB\n\x07\f\x07\x0E" +
		"\x07\u01DE\v\x07\x03\x07\x03\x07\x03\x07\x03\x07\x03\x07\x07\x07\u01E5" +
		"\n\x07\f\x07\x0E\x07\u01E8\v\x07\x03\x07\x03\x07\x03\x07\x03\x07\x03\x07" +
		"\x03\x07\x03\x07\x03\x07\x03\x07\x03\x07\x05\x07\u01F4\n\x07\x03\b\x03" +
		"\b\x07\b\u01F8\n\b\f\b\x0E\b\u01FB\v\b\x03\t\x03\t\x05\t\u01FF\n\t\x03" +
		"\t\x03\t\x03\n\x03\n\x03\n\x05\n\u0206\n\n\x03\n\x07\n\u0209\n\n\f\n\x0E" +
		"\n\u020C\v\n\x03\n\x03\n\x03\n\x03\n\x05\n\u0212\n\n\x03\n\x03\n\x03\n" +
		"\x07\n\u0217\n\n\f\n\x0E\n\u021A\v\n\x03\n\x03\n\x03\n\x03\n\x05\n\u0220" +
		"\n\n\x03\n\x03\n\x03\n\x03\n\x03\n\x05\n\u0227\n\n\x03\n\x03\n\x03\n\x05" +
		"\n\u022C\n\n\x03\v\x03\v\x03\v\x03\v\x05\v\u0232\n\v\x03\v\x03\v\x03\v" +
		"\x03\v\x05\v\u0238\n\v\x03\f\x03\f\x03\f\x03\f\x03\f\x03\f\x03\f\x03\f" +
		"\x03\f\x03\f\x05\f\u0244\n\f\x03\f\x03\f\x03\f\x03\f\x03\f\x05\f\u024B" +
		"\n\f\x03\f\x03\f\x03\f\x03\f\x03\f\x03\f\x07\f\u0253\n\f\f\f\x0E\f\u0256" +
		"\v\f\x05\f\u0258\n\f\x03\r\x03\r\x03\r\x03\r\x03\r\x03\r\x03\r\x03\r\x03" +
		"\r\x03\r\x03\r\x03\r\x05\r\u0266\n\r\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x05" +
		"\x0E\u026C\n\x0E\x03\x0E\x03\x0E\x03\x0E\x07\x0E\u0271\n\x0E\f\x0E\x0E" +
		"\x0E\u0274\v\x0E\x03\x0E\x07\x0E\u0277\n\x0E\f\x0E\x0E\x0E\u027A\v\x0E" +
		"\x03\x0F\x03\x0F\x05\x0F\u027E\n\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x07" +
		"\x0F\u0284\n\x0F\f\x0F\x0E\x0F\u0287\v\x0F\x03\x0F\x03\x0F\x03\x0F\x03" +
		"\x0F\x07\x0F\u028D\n\x0F\f\x0F\x0E\x0F\u0290\v\x0F\x03\x0F\x03\x0F\x05" +
		"\x0F\u0294\n\x0F\x03\x10\x03\x10\x03\x10\x05\x10\u0299\n\x10\x05\x10\u029B" +
		"\n\x10\x03\x10\x03\x10\x03\x10\x05\x10\u02A0\n\x10\x03\x11\x03\x11\x03" +
		"\x12\x03\x12\x03\x13\x03\x13\x03\x13\x05\x13\u02A9\n\x13\x03\x14\x03\x14" +
		"\x05\x14\u02AD\n\x14\x03\x14\x03\x14\x05\x14\u02B1\n\x14\x03\x14\x03\x14" +
		"\x05\x14\u02B5\n\x14\x03\x14\x05\x14\u02B8\n\x14\x03\x15\x03\x15\x03\x15" +
		"\x03\x15\x06\x15\u02BE\n\x15\r\x15\x0E\x15\u02BF\x05\x15\u02C2\n\x15\x03" +
		"\x16\x03\x16\x03\x16\x03\x16\x03\x16\x05\x16\u02C9\n\x16\x03\x17\x03\x17" +
		"\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x05\x18" +
		"\u02D5\n\x18\x03\x19\x03\x19\x03\x1A\x03\x1A\x03\x1A\x02\x02\x02\x1B\x02" +
		"\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x10\x02\x12\x02\x14\x02" +
		"\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 \x02\"\x02$\x02&\x02(\x02*\x02" +
		",\x02.\x020\x022\x02\x02\x03\x04\x02\x0E\x0E\x16\x16\x02\u0349\x024\x03" +
		"\x02\x02\x02\x049\x03\x02\x02\x02\x06\u01B8\x03\x02\x02\x02\b\u01BA\x03" +
		"\x02\x02\x02\n\u01BF\x03\x02\x02\x02\f\u01F3\x03\x02\x02\x02\x0E\u01F5" +
		"\x03\x02\x02\x02\x10\u01FE\x03\x02\x02\x02\x12\u022B\x03\x02\x02\x02\x14" +
		"\u0237\x03\x02\x02\x02\x16\u0257\x03\x02\x02\x02\x18\u0265\x03\x02\x02" +
		"\x02\x1A\u026B\x03\x02\x02\x02\x1C\u0293\x03\x02\x02\x02\x1E\u029A\x03" +
		"\x02\x02\x02 \u02A1\x03\x02\x02\x02\"\u02A3\x03\x02\x02\x02$\u02A8\x03" +
		"\x02\x02\x02&\u02B7\x03\x02\x02\x02(\u02C1\x03\x02\x02\x02*\u02C8\x03" +
		"\x02\x02\x02,\u02CA\x03\x02\x02\x02.\u02D4\x03\x02\x02\x020\u02D6\x03" +
		"\x02\x02\x022\u02D8\x03\x02\x02\x0245\x05\x04\x03\x025\x03\x03\x02\x02" +
		"\x0268\x05\x06\x04\x0276\x03\x02\x02\x028;\x03\x02\x02\x0297\x03\x02\x02" +
		"\x029:\x03\x02\x02\x02:<\x03\x02\x02\x02;9\x03\x02\x02\x02<=\x07\x02\x02" +
		"\x03=\x05\x03\x02\x02\x02>?\x07\x05\x02\x02?A\x05 \x11\x02@B\x05(\x15" +
		"\x02A@\x03\x02\x02\x02AB\x03\x02\x02\x02BF\x03\x02\x02\x02CE\x05\f\x07" +
		"\x02DC\x03\x02\x02\x02EH\x03\x02\x02\x02FD\x03\x02\x02\x02FG\x03\x02\x02" +
		"\x02G\u01B9\x03\x02\x02\x02HF\x03\x02\x02\x02IK\x07\"\x02\x02JL\x07\x1E" +
		"\x02\x02KJ\x03\x02\x02\x02KL\x03\x02\x02\x02LM\x03\x02\x02\x02MQ\x05 " +
		"\x11\x02NP\x05\f\x07\x02ON\x03\x02\x02\x02PS\x03\x02\x02\x02QO\x03\x02" +
		"\x02\x02QR\x03\x02\x02\x02RT\x03\x02\x02\x02SQ\x03\x02\x02\x02TU\x07\x06" +
		"\x02\x02U\u01B9\x03\x02\x02\x02VX\x07#\x02\x02WY\x07\x1E\x02\x02XW\x03" +
		"\x02\x02\x02XY\x03\x02\x02\x02YZ\x03\x02\x02\x02Z^\x05 \x11\x02[]\x05" +
		"\f\x07\x02\\[\x03\x02\x02\x02]`\x03\x02\x02\x02^\\\x03\x02\x02\x02^_\x03" +
		"\x02\x02\x02_a\x03\x02\x02\x02`^\x03\x02\x02\x02ab\x07\x06\x02\x02b\u01B9" +
		"\x03\x02\x02\x02cl\x07$\x02\x02dg\x07\x07\x02\x02ef\x07\t\x02\x02fh\x05" +
		"0\x19\x02ge\x03\x02\x02\x02gh\x03\x02\x02\x02hi\x03\x02\x02\x02ij\x05" +
		"(\x15\x02jk\x07\n\x02\x02km\x03\x02\x02\x02ld\x03\x02\x02\x02lm\x03\x02" +
		"\x02\x02mo\x03\x02\x02\x02np\x07\x1E\x02\x02on\x03\x02\x02\x02op\x03\x02" +
		"\x02\x02pq\x03\x02\x02\x02qr\x05 \x11\x02rs\x05(\x15\x02st\x05\x1A\x0E" +
		"\x02tu\x05\x16\f\x02u\u01B9\x03\x02\x02\x02vw\x07%\x02\x02wx\x05 \x11" +
		"\x02xy\x05(\x15\x02y}\x05(\x15\x02z|\x05\x1C\x0F\x02{z\x03\x02\x02\x02" +
		"|\x7F\x03\x02\x02\x02}{\x03\x02\x02\x02}~\x03\x02\x02\x02~\x80\x03\x02" +
		"\x02\x02\x7F}\x03\x02\x02\x02\x80\x81\x05\x16\f\x02\x81\u01B9\x03\x02" +
		"\x02\x02\x82\x87\x078\x02\x02\x83\x87\x079\x02\x02\x84\x87\x07:\x02\x02" +
		"\x85\x87\x07;\x02\x02\x86\x82\x03\x02\x02\x02\x86\x83\x03\x02\x02\x02" +
		"\x86\x84\x03\x02\x02\x02\x86\x85\x03\x02\x02\x02\x87\x89\x03\x02\x02\x02" +
		"\x88\x8A\x07\x19\x02\x02\x89\x88\x03\x02\x02\x02\x89\x8A\x03\x02\x02\x02" +
		"\x8A\x8C\x03\x02\x02\x02\x8B\x8D\x07\x1E\x02\x02\x8C\x8B\x03\x02\x02\x02" +
		"\x8C\x8D\x03\x02\x02\x02\x8D\x8E\x03\x02\x02\x02\x8E\x8F\x05 \x11\x02" +
		"\x8F\x90\x05(\x15\x02\x90\x94\x05(\x15\x02\x91\x93\x05\x1C\x0F\x02\x92" +
		"\x91\x03\x02\x02\x02\x93\x96\x03\x02\x02\x02\x94\x92\x03\x02\x02\x02\x94" +
		"\x95\x03\x02\x02\x02\x95\x97\x03\x02\x02\x02\x96\x94\x03\x02\x02\x02\x97" +
		"\x98\x07\x06\x02\x02\x98\u01B9\x03\x02\x02\x02\x99\x9C\x07&\x02\x02\x9A" +
		"\x9C\x077\x02\x02\x9B\x99\x03\x02\x02\x02\x9B\x9A\x03\x02\x02\x02\x9C" +
		"\x9D\x03\x02\x02\x02\x9D\xA1\x05 \x11\x02\x9E\xA0\x05(\x15\x02\x9F\x9E" +
		"\x03\x02\x02\x02\xA0\xA3\x03\x02\x02\x02\xA1\x9F\x03\x02\x02\x02\xA1\xA2" +
		"\x03\x02\x02\x02\xA2\xA5\x03\x02\x02\x02\xA3\xA1\x03\x02\x02\x02\xA4\xA6" +
		"\x050\x19\x02\xA5\xA4\x03\x02\x02\x02\xA5\xA6\x03\x02\x02\x02\xA6\xAA" +
		"\x03\x02\x02\x02\xA7\xA9\x05\x12\n\x02\xA8\xA7\x03\x02\x02\x02\xA9\xAC" +
		"\x03\x02\x02\x02\xAA\xA8\x03\x02\x02\x02\xAA\xAB\x03\x02\x02\x02\xAB\xAD" +
		"\x03\x02\x02\x02\xAC\xAA\x03\x02\x02\x02\xAD\xAE\x07\x06\x02\x02\xAE\u01B9" +
		"\x03\x02\x02\x02\xAF\xB0\x07\'\x02\x02\xB0\xB1\x05 \x11\x02\xB1\xB2\x05" +
		"(\x15\x02\xB2\xB6\x05(\x15\x02\xB3\xB5\x05(\x15\x02\xB4\xB3\x03\x02\x02" +
		"\x02\xB5\xB8\x03\x02\x02\x02\xB6\xB4\x03\x02\x02\x02\xB6\xB7\x03\x02\x02" +
		"\x02\xB7\xBC\x03\x02\x02\x02\xB8\xB6\x03\x02\x02\x02\xB9\xBB\x05\n\x06" +
		"\x02\xBA\xB9\x03\x02\x02\x02\xBB\xBE\x03\x02\x02\x02\xBC\xBA\x03\x02\x02" +
		"\x02\xBC\xBD\x03\x02\x02\x02\xBD\u01B9\x03\x02\x02\x02\xBE\xBC\x03\x02" +
		"\x02\x02\xBF\xC0\x07(\x02\x02\xC0\xC1\x05 \x11\x02\xC1\xC2\x05(\x15\x02" +
		"\xC2\xC6\x05(\x15\x02\xC3\xC5\x05(\x15\x02\xC4\xC3\x03\x02\x02\x02\xC5" +
		"\xC8\x03\x02\x02\x02\xC6\xC4\x03\x02\x02\x02\xC6\xC7\x03\x02\x02\x02\xC7" +
		"\xD0\x03\x02\x02\x02\xC8\xC6\x03\x02\x02\x02\xC9\xCD\x07\x11\x02\x02\xCA" +
		"\xCC\x05(\x15\x02\xCB\xCA\x03\x02\x02\x02\xCC\xCF\x03\x02\x02\x02\xCD" +
		"\xCB\x03\x02\x02\x02\xCD\xCE\x03\x02\x02\x02\xCE\xD1\x03\x02\x02\x02\xCF" +
		"\xCD\x03\x02\x02\x02\xD0\xC9\x03\x02\x02\x02\xD0\xD1\x03\x02\x02\x02\xD1" +
		"\xD5\x03\x02\x02\x02\xD2\xD4\x05\n\x06\x02\xD3\xD2\x03\x02\x02\x02\xD4" +
		"\xD7\x03\x02\x02\x02\xD5\xD3\x03\x02\x02\x02\xD5\xD6\x03\x02\x02\x02\xD6" +
		"\u01B9\x03\x02\x02\x02\xD7\xD5\x03\x02\x02\x02\xD8\xD9\x07)\x02\x02\xD9" +
		"\xDA\x05 \x11\x02\xDA\xDE\x07\x05\x02\x02\xDB\xDD\x05(\x15\x02\xDC\xDB" +
		"\x03\x02\x02\x02\xDD\xE0\x03\x02\x02\x02\xDE\xDC\x03\x02\x02\x02\xDE\xDF" +
		"\x03\x02\x02\x02\xDF\xE1\x03\x02\x02\x02\xE0\xDE\x03\x02\x02\x02\xE1\xE2" +
		"\x07\x06\x02\x02\xE2\xE6\x07\x05\x02\x02\xE3\xE5\x05(\x15\x02\xE4\xE3" +
		"\x03\x02\x02\x02\xE5\xE8\x03\x02\x02\x02\xE6\xE4\x03\x02\x02\x02\xE6\xE7" +
		"\x03\x02\x02\x02\xE7\xE9\x03\x02\x02\x02\xE8\xE6\x03\x02\x02\x02\xE9\xEA" +
		"\x07\x06\x02\x02\xEA\xEE\x05(\x15\x02\xEB\xED\x05\n\x06\x02\xEC\xEB\x03" +
		"\x02\x02\x02\xED\xF0\x03\x02\x02\x02\xEE\xEC\x03\x02\x02\x02\xEE\xEF\x03" +
		"\x02\x02\x02\xEF\u01B9\x03\x02\x02\x02\xF0\xEE\x03\x02\x02\x02\xF1\xF2" +
		"\x07*\x02\x02\xF2\xF3\x05 \x11\x02\xF3\xF7\x07\x05\x02\x02\xF4\xF6\x05" +
		"(\x15\x02\xF5\xF4\x03\x02\x02\x02\xF6\xF9\x03\x02\x02\x02\xF7\xF5\x03" +
		"\x02\x02\x02\xF7\xF8\x03\x02\x02\x02\xF8\xFA\x03\x02\x02\x02\xF9\xF7\x03" +
		"\x02\x02\x02\xFA\xFB\x07\x06\x02\x02\xFB\xFF\x07\x05\x02\x02\xFC\xFE\x05" +
		"(\x15\x02\xFD\xFC\x03\x02\x02\x02\xFE\u0101\x03\x02\x02\x02\xFF\xFD\x03" +
		"\x02\x02\x02\xFF\u0100\x03\x02\x02\x02\u0100\u0102\x03\x02\x02\x02\u0101" +
		"\xFF\x03\x02\x02\x02\u0102\u0103\x07\x06\x02\x02\u0103\u0104\x05(\x15" +
		"\x02\u0104\u0108\x05(\x15\x02\u0105\u0107\x05\n\x06\x02\u0106\u0105\x03" +
		"\x02\x02\x02\u0107\u010A\x03\x02\x02\x02\u0108\u0106\x03\x02\x02\x02\u0108" +
		"\u0109\x03\x02\x02\x02\u0109\u01B9\x03\x02\x02\x02\u010A\u0108\x03\x02" +
		"\x02\x02\u010B\u010C\x07+\x02\x02\u010C\u010D\x05 \x11\x02\u010D\u0111" +
		"\x07\x05\x02\x02\u010E\u0110\x05(\x15\x02\u010F\u010E\x03\x02\x02\x02" +
		"\u0110\u0113\x03\x02\x02\x02\u0111\u010F\x03\x02\x02\x02\u0111\u0112\x03" +
		"\x02\x02\x02\u0112\u0114\x03\x02\x02\x02\u0113\u0111\x03\x02\x02\x02\u0114" +
		"\u0115\x07\x06\x02\x02\u0115\u0119\x07\x05\x02\x02\u0116\u0118\x05(\x15" +
		"\x02\u0117\u0116\x03\x02\x02\x02\u0118\u011B\x03\x02\x02\x02\u0119\u0117" +
		"\x03\x02\x02\x02\u0119\u011A\x03\x02\x02\x02\u011A\u011C\x03\x02\x02\x02" +
		"\u011B\u0119\x03\x02\x02\x02\u011C\u011D\x07\x06\x02\x02\u011D\u011E\x05" +
		"(\x15\x02\u011E\u0122\x05(\x15\x02\u011F\u0121\x05\n\x06\x02\u0120\u011F" +
		"\x03\x02\x02\x02\u0121\u0124\x03\x02\x02\x02\u0122\u0120\x03\x02\x02\x02" +
		"\u0122\u0123\x03\x02\x02\x02\u0123\u01B9\x03\x02\x02\x02\u0124\u0122\x03" +
		"\x02\x02\x02\u0125\u0126\x07,\x02\x02\u0126\u0127\x05 \x11\x02\u0127\u012B" +
		"\x07\x05\x02\x02\u0128\u012A\x05(\x15\x02\u0129\u0128\x03\x02\x02\x02" +
		"\u012A\u012D\x03\x02\x02\x02\u012B\u0129\x03\x02\x02\x02\u012B\u012C\x03" +
		"\x02\x02\x02\u012C\u012E\x03\x02\x02\x02\u012D\u012B\x03\x02\x02\x02\u012E" +
		"\u012F\x07\x06\x02\x02\u012F\u0133\x07\x05\x02\x02\u0130\u0132\x05(\x15" +
		"\x02\u0131\u0130\x03\x02\x02\x02\u0132\u0135\x03\x02\x02\x02\u0133\u0131" +
		"\x03\x02\x02\x02\u0133\u0134\x03\x02\x02\x02\u0134\u0136\x03\x02\x02\x02" +
		"\u0135\u0133\x03\x02\x02\x02\u0136\u0137\x07\x06\x02\x02\u0137\u013B\x07" +
		"\x05\x02\x02\u0138\u013A\x05\b\x05\x02\u0139\u0138\x03\x02\x02\x02\u013A" +
		"\u013D\x03\x02\x02\x02\u013B\u0139\x03\x02\x02\x02\u013B\u013C\x03\x02" +
		"\x02\x02\u013C\u013E\x03\x02\x02\x02\u013D\u013B\x03\x02\x02\x02\u013E" +
		"\u013F\x07\x06\x02\x02\u013F\u01B9\x03\x02\x02\x02\u0140\u0141\x07-\x02" +
		"\x02\u0141\u0145\x05 \x11\x02\u0142\u0144\x05\f\x07\x02\u0143\u0142\x03" +
		"\x02\x02\x02\u0144\u0147\x03\x02\x02\x02\u0145\u0143\x03\x02\x02\x02\u0145" +
		"\u0146\x03\x02\x02\x02\u0146\u0148\x03\x02\x02\x02\u0147\u0145\x03\x02" +
		"\x02\x02\u0148\u0149\x07\x06\x02\x02\u0149\u01B9\x03\x02\x02\x02\u014A" +
		"\u014B\x07.\x02\x02\u014B\u014C\x05 \x11\x02\u014C\u014D\x05(\x15\x02" +
		"\u014D\u014E\x050\x19\x02\u014E\u01B9\x03\x02\x02\x02\u014F\u0150\x07" +
		"6\x02\x02\u0150\u0151\x05 \x11\x02\u0151\u0152\x05(\x15\x02\u0152\u0153" +
		"\x05\"\x12\x02\u0153\u01B9\x03\x02\x02\x02\u0154\u0155\x07/\x02\x02\u0155" +
		"\u0156\x05 \x11\x02\u0156\u0157\x05(\x15\x02\u0157\u015B\x05(\x15\x02" +
		"\u0158\u015A\x05(\x15\x02\u0159\u0158\x03\x02\x02\x02\u015A\u015D\x03" +
		"\x02\x02\x02\u015B\u0159\x03\x02\x02\x02\u015B\u015C\x03\x02\x02\x02\u015C" +
		"\u0161\x03\x02\x02\x02\u015D\u015B\x03\x02\x02\x02\u015E\u0160\x05\n\x06" +
		"\x02\u015F\u015E\x03\x02\x02\x02\u0160\u0163\x03\x02\x02\x02\u0161\u015F" +
		"\x03\x02\x02\x02\u0161\u0162\x03\x02\x02\x02\u0162\u01B9\x03\x02\x02\x02" +
		"\u0163\u0161\x03\x02\x02\x02\u0164\u0165\x070\x02\x02\u0165\u0166\x05" +
		" \x11\x02\u0166\u0167\x05(\x15\x02\u0167\u016B\x05(\x15\x02\u0168\u016A" +
		"\x05\n\x06\x02\u0169\u0168\x03\x02\x02\x02\u016A\u016D\x03\x02\x02\x02" +
		"\u016B\u0169\x03\x02\x02\x02\u016B\u016C\x03\x02\x02\x02\u016C\u01B9\x03" +
		"\x02\x02\x02\u016D\u016B\x03\x02\x02\x02\u016E\u016F\x071\x02\x02\u016F" +
		"\u0170\x05(\x15\x02\u0170\u0171\x05(\x15\x02\u0171\u0175\x05(\x15\x02" +
		"\u0172\u0174\x05\n\x06\x02\u0173\u0172\x03\x02\x02\x02\u0174\u0177\x03" +
		"\x02\x02\x02\u0175\u0173\x03\x02\x02\x02\u0175\u0176\x03\x02\x02\x02\u0176" +
		"\u01B9\x03\x02\x02\x02\u0177\u0175\x03\x02\x02\x02\u0178\u0179\x072\x02" +
		"\x02\u0179\u017A\x05 \x11\x02\u017A\u017B\x05(\x15\x02\u017B\u017F\x05" +
		"(\x15\x02\u017C\u017E\x05 \x11\x02\u017D\u017C\x03\x02\x02\x02\u017E\u0181" +
		"\x03\x02\x02\x02\u017F\u017D\x03\x02\x02\x02\u017F\u0180\x03\x02\x02\x02" +
		"\u0180\u0185\x03\x02\x02\x02\u0181\u017F\x03\x02\x02\x02\u0182\u0184\x05" +
		"\n\x06\x02\u0183\u0182\x03\x02\x02\x02\u0184\u0187\x03\x02\x02\x02\u0185" +
		"\u0183\x03\x02\x02\x02\u0185\u0186\x03\x02\x02\x02\u0186\u01B9\x03\x02" +
		"\x02\x02\u0187\u0185\x03\x02\x02\x02\u0188\u0189\x073\x02\x02\u0189\u018A" +
		"\x05(\x15\x02\u018A\u018B\x05(\x15\x02\u018B\u018F\x05(\x15\x02\u018C" +
		"\u018E\x05(\x15\x02\u018D\u018C\x03\x02\x02\x02\u018E\u0191\x03\x02\x02" +
		"\x02\u018F\u018D\x03\x02\x02\x02\u018F\u0190\x03\x02\x02\x02\u0190\u0195" +
		"\x03\x02\x02\x02\u0191\u018F\x03\x02\x02\x02\u0192\u0194\x05\n\x06\x02" +
		"\u0193\u0192\x03\x02\x02\x02\u0194\u0197\x03\x02\x02\x02\u0195\u0193\x03" +
		"\x02\x02\x02\u0195\u0196\x03\x02\x02\x02\u0196\u01B9\x03\x02\x02\x02\u0197" +
		"\u0195\x03\x02\x02\x02\u0198\u0199\x074\x02\x02\u0199\u019A\x05 \x11\x02" +
		"\u019A\u019B\x05(\x15\x02\u019B\u019F\x05(\x15\x02\u019C\u019E\x05 \x11" +
		"\x02\u019D\u019C\x03\x02\x02\x02\u019E\u01A1\x03\x02\x02\x02\u019F\u019D" +
		"\x03\x02\x02\x02\u019F\u01A0\x03\x02\x02\x02\u01A0\u01A5\x03\x02\x02\x02" +
		"\u01A1\u019F\x03\x02\x02\x02\u01A2\u01A4\x05\n\x06\x02\u01A3\u01A2\x03" +
		"\x02\x02\x02\u01A4\u01A7\x03\x02\x02\x02\u01A5\u01A3\x03\x02\x02\x02\u01A5" +
		"\u01A6\x03\x02\x02\x02\u01A6\u01B9\x03\x02\x02\x02\u01A7\u01A5\x03\x02" +
		"\x02\x02\u01A8\u01A9\x075\x02\x02\u01A9\u01AA\x05(\x15\x02\u01AA\u01AB" +
		"\x05(\x15\x02\u01AB\u01AF\x05(\x15\x02\u01AC\u01AE\x05(\x15\x02\u01AD" +
		"\u01AC\x03\x02\x02\x02\u01AE\u01B1\x03\x02\x02\x02\u01AF\u01AD\x03\x02" +
		"\x02\x02\u01AF\u01B0\x03\x02\x02\x02\u01B0\u01B5\x03\x02\x02\x02\u01B1" +
		"\u01AF\x03\x02\x02\x02\u01B2\u01B4\x05\n\x06\x02\u01B3\u01B2\x03\x02\x02" +
		"\x02\u01B4\u01B7\x03\x02\x02\x02\u01B5\u01B3\x03\x02\x02\x02\u01B5\u01B6" +
		"\x03\x02\x02\x02\u01B6\u01B9\x03\x02\x02\x02\u01B7\u01B5\x03\x02\x02\x02" +
		"\u01B8>\x03\x02\x02\x02\u01B8I\x03\x02\x02\x02\u01B8V\x03\x02\x02\x02" +
		"\u01B8c\x03\x02\x02\x02\u01B8v\x03\x02\x02\x02\u01B8\x86\x03\x02\x02\x02" +
		"\u01B8\x9B\x03\x02\x02\x02\u01B8\xAF\x03\x02\x02\x02\u01B8\xBF\x03\x02" +
		"\x02\x02\u01B8\xD8\x03\x02\x02\x02\u01B8\xF1\x03\x02\x02\x02\u01B8\u010B" +
		"\x03\x02\x02\x02\u01B8\u0125\x03\x02\x02\x02\u01B8\u0140\x03\x02\x02\x02" +
		"\u01B8\u014A\x03\x02\x02\x02\u01B8\u014F\x03\x02\x02\x02\u01B8\u0154\x03" +
		"\x02\x02\x02\u01B8\u0164\x03\x02\x02\x02\u01B8\u016E\x03\x02\x02\x02\u01B8" +
		"\u0178\x03\x02\x02\x02\u01B8\u0188\x03\x02\x02\x02\u01B8\u0198\x03\x02" +
		"\x02\x02\u01B8\u01A8\x03\x02\x02\x02\u01B9\x07\x03\x02\x02\x02\u01BA\u01BB" +
		"\x05(\x15\x02\u01BB\u01BC\x05(\x15\x02\u01BC\t\x03\x02\x02\x02\u01BD\u01C0" +
		"\x07\x07\x02\x02\u01BE\u01C0\x07\b\x02\x02\u01BF\u01BD\x03\x02\x02\x02" +
		"\u01BF\u01BE\x03\x02\x02\x02\u01C0\u01C1\x03\x02\x02\x02\u01C1\u01C2\x05" +
		"(\x15\x02\u01C2\v\x03\x02\x02\x02\u01C3\u01C6\x07\x07\x02\x02\u01C4\u01C5" +
		"\x07\t\x02\x02\u01C5\u01C7\x050\x19\x02\u01C6\u01C4\x03\x02\x02\x02\u01C6" +
		"\u01C7\x03\x02\x02\x02\u01C7\u01C8\x03\x02\x02\x02\u01C8\u01CA\x05(\x15" +
		"\x02\u01C9\u01CB\x07\n\x02\x02\u01CA\u01C9\x03\x02\x02\x02\u01CA\u01CB" +
		"\x03\x02\x02\x02\u01CB\u01CD\x03\x02\x02\x02\u01CC\u01CE\x07\x05\x02\x02" +
		"\u01CD\u01CC\x03\x02\x02\x02\u01CD\u01CE\x03\x02\x02\x02\u01CE\u01CF\x03" +
		"\x02\x02\x02\u01CF\u01D0\x05(\x15\x02\u01D0\u01D1\x07\x1D\x02\x02\u01D1" +
		"\u01D6\x05\"\x12\x02\u01D2\u01D3\x07\v\x02\x02\u01D3\u01D5\x05\"\x12\x02" +
		"\u01D4\u01D2\x03\x02\x02\x02\u01D5\u01D8\x03\x02\x02\x02\u01D6\u01D4\x03" +
		"\x02\x02\x02\u01D6\u01D7\x03\x02\x02\x02\u01D7\u01DC\x03\x02\x02\x02\u01D8" +
		"\u01D6\x03\x02\x02\x02\u01D9\u01DB\x05\x12\n\x02\u01DA\u01D9\x03\x02\x02" +
		"\x02\u01DB\u01DE\x03\x02\x02\x02\u01DC\u01DA\x03\x02\x02\x02\u01DC\u01DD" +
		"\x03\x02\x02\x02\u01DD\u01DF\x03\x02\x02\x02\u01DE\u01DC\x03\x02\x02\x02" +
		"\u01DF\u01E0\x07\x06\x02\x02\u01E0\u01F4\x03\x02\x02\x02\u01E1\u01E2\x07" +
		"\x17\x02\x02\u01E2\u01E6\x05 \x11\x02\u01E3\u01E5\x05\f\x07\x02\u01E4" +
		"\u01E3\x03\x02\x02\x02\u01E5\u01E8\x03\x02\x02\x02\u01E6\u01E4\x03\x02" +
		"\x02\x02\u01E6\u01E7\x03\x02\x02\x02\u01E7\u01E9\x03\x02\x02\x02\u01E8" +
		"\u01E6\x03\x02\x02\x02\u01E9\u01EA\x07\x06\x02\x02\u01EA\u01F4\x03\x02" +
		"\x02\x02\u01EB\u01EC\x07\x18\x02\x02\u01EC\u01ED\x05 \x11\x02\u01ED\u01EE" +
		"\x05(\x15\x02\u01EE\u01EF\x05\x0E\b\x02\u01EF\u01F0\x07\x06\x02\x02\u01F0" +
		"\u01F1\x05 \x11\x02\u01F1\u01F2\x05(\x15\x02\u01F2\u01F4\x03\x02\x02\x02" +
		"\u01F3\u01C3\x03\x02";
	private static readonly _serializedATNSegment1: string =
		"\x02\x02\u01F3\u01E1\x03\x02\x02\x02\u01F3\u01EB\x03\x02\x02\x02\u01F4" +
		"\r\x03\x02\x02\x02\u01F5\u01F9\x05\x1E\x10\x02\u01F6\u01F8\x05\x10\t\x02" +
		"\u01F7\u01F6\x03\x02\x02\x02\u01F8\u01FB\x03\x02\x02\x02\u01F9\u01F7\x03" +
		"\x02\x02\x02\u01F9\u01FA\x03\x02\x02\x02\u01FA\x0F\x03\x02\x02\x02\u01FB" +
		"\u01F9\x03\x02\x02\x02\u01FC\u01FF\x07\f\x02\x02\u01FD\u01FF\x07\v\x02" +
		"\x02\u01FE\u01FC\x03\x02\x02\x02\u01FE\u01FD\x03\x02\x02\x02\u01FF\u0200" +
		"\x03\x02\x02\x02\u0200\u0201\x05\x1E\x10\x02\u0201\x11\x03\x02\x02\x02" +
		"\u0202\u0203\x07\x07\x02\x02\u0203\u0205\x05(\x15\x02\u0204\u0206\x07" +
		"\n\x02\x02\u0205\u0204\x03\x02\x02\x02\u0205\u0206\x03\x02\x02\x02\u0206" +
		"\u020A\x03\x02\x02\x02\u0207\u0209\x05\x18\r\x02\u0208\u0207\x03\x02\x02" +
		"\x02\u0209\u020C\x03\x02\x02\x02\u020A\u0208\x03\x02\x02\x02\u020A\u020B" +
		"\x03\x02\x02\x02\u020B\u020D\x03\x02\x02\x02\u020C\u020A\x03\x02\x02\x02" +
		"\u020D\u020E\x05\x14\v\x02\u020E\u022C\x03\x02\x02\x02\u020F\u0211\x07" +
		"\x0E\x02\x02\u0210\u0212\x05(\x15\x02\u0211\u0210\x03\x02\x02\x02\u0211" +
		"\u0212\x03\x02\x02\x02\u0212\u0213\x03\x02\x02\x02\u0213\u0214\x07\x0E" +
		"\x02\x02\u0214\u0218\x05\"\x12\x02\u0215\u0217\x05\x18\r\x02\u0216\u0215" +
		"\x03\x02\x02\x02\u0217\u021A\x03\x02\x02\x02\u0218\u0216\x03\x02\x02\x02" +
		"\u0218\u0219\x03\x02\x02\x02\u0219\u021B\x03\x02\x02\x02\u021A\u0218\x03" +
		"\x02\x02\x02\u021B\u021C\x05\x14\v\x02\u021C\u022C\x03\x02\x02\x02\u021D" +
		"\u021F\x07\x0F\x02\x02\u021E\u0220\x07\x19\x02\x02\u021F\u021E\x03\x02" +
		"\x02\x02\u021F\u0220\x03\x02\x02\x02\u0220\u0221\x03\x02\x02\x02\u0221" +
		"\u0222\x05 \x11\x02\u0222\u0223\x05(\x15\x02\u0223\u022C\x03\x02\x02\x02" +
		"\u0224\u0226\x07\x10\x02\x02\u0225\u0227\x07\x19\x02\x02\u0226\u0225\x03" +
		"\x02\x02\x02\u0226\u0227\x03\x02\x02\x02\u0227\u0228\x03\x02\x02\x02\u0228" +
		"\u0229\x05 \x11\x02\u0229\u022A\x05(\x15\x02\u022A\u022C\x03\x02\x02\x02" +
		"\u022B\u0202\x03\x02\x02\x02\u022B\u020F\x03\x02\x02\x02\u022B\u021D\x03" +
		"\x02\x02\x02\u022B\u0224\x03\x02\x02\x02\u022C\x13\x03\x02\x02\x02\u022D" +
		"\u022E\t\x02\x02\x02\u022E\u0238\x05(\x15\x02\u022F\u0231\x07\x1A\x02" +
		"\x02\u0230\u0232\x07\x1E\x02\x02\u0231\u0230\x03\x02\x02\x02\u0231\u0232" +
		"\x03\x02\x02\x02\u0232\u0233\x03\x02\x02\x02\u0233\u0234\x05 \x11\x02" +
		"\u0234\u0235\x05(\x15\x02\u0235\u0238\x03\x02\x02\x02\u0236\u0238\x07" +
		"\x1C\x02\x02\u0237\u022D\x03\x02\x02\x02\u0237\u022F\x03\x02\x02\x02\u0237" +
		"\u0236\x03\x02\x02\x02\u0238\x15\x03\x02\x02\x02\u0239\u023A\x07\x06\x02" +
		"\x02\u023A\u023B\x05 \x11\x02\u023B\u023C\x05(\x15\x02\u023C\u0258\x03" +
		"\x02\x02\x02\u023D\u023E\x07\x1A\x02\x02\u023E\u023F\x05 \x11\x02\u023F" +
		"\u0240\x05(\x15\x02\u0240\u0258\x03\x02\x02\x02\u0241\u0243\x07\x0F\x02" +
		"\x02\u0242\u0244\x07\x19\x02\x02\u0243\u0242\x03\x02\x02\x02\u0243\u0244" +
		"\x03\x02\x02\x02\u0244\u0245\x03\x02\x02\x02\u0245\u0246\x05 \x11\x02" +
		"\u0246\u0247\x05(\x15\x02\u0247\u0258\x03\x02\x02\x02\u0248\u024A\x07" +
		"\x10\x02\x02\u0249\u024B\x07\x19\x02\x02\u024A\u0249\x03\x02\x02\x02\u024A" +
		"\u024B\x03\x02\x02\x02\u024B\u024C\x03\x02\x02\x02\u024C\u024D\x05 \x11" +
		"\x02\u024D\u024E\x05(\x15\x02\u024E\u0258\x03\x02\x02\x02\u024F\u0258" +
		"\x07\x1C\x02\x02\u0250\u0254\x07\x06\x02\x02\u0251\u0253\x05\x12\n\x02" +
		"\u0252\u0251\x03\x02\x02\x02\u0253\u0256\x03\x02\x02\x02\u0254\u0252\x03" +
		"\x02\x02\x02\u0254\u0255\x03\x02\x02\x02\u0255\u0258\x03\x02\x02\x02\u0256" +
		"\u0254\x03\x02\x02\x02\u0257\u0239\x03\x02\x02\x02\u0257\u023D\x03\x02" +
		"\x02\x02\u0257\u0241\x03\x02\x02\x02\u0257\u0248\x03\x02\x02\x02\u0257" +
		"\u024F\x03\x02\x02\x02\u0257\u0250\x03\x02\x02\x02\u0258\x17\x03\x02\x02" +
		"\x02\u0259\u025A\x07\x1B\x02\x02\u025A\u0266\x05&\x14\x02\u025B\u025C" +
		"\x07\x11\x02\x02\u025C\u0266\x05(\x15\x02\u025D\u025E\x07\x12\x02\x02" +
		"\u025E\u0266\x05&\x14\x02\u025F\u0260\x07\x13\x02\x02\u0260\u0266\x05" +
		"&\x14\x02\u0261\u0262\x07\x14\x02\x02\u0262\u0266\x05&\x14\x02\u0263\u0264" +
		"\x07\x15\x02\x02\u0264\u0266\x05(\x15\x02\u0265\u0259\x03\x02\x02\x02" +
		"\u0265\u025B\x03\x02\x02\x02\u0265\u025D\x03\x02\x02\x02\u0265\u025F\x03" +
		"\x02\x02\x02\u0265\u0261\x03\x02\x02\x02\u0265\u0263\x03\x02\x02\x02\u0266" +
		"\x19\x03\x02\x02\x02\u0267\u0268\x07\x07\x02\x02\u0268\u0269\x05(\x15" +
		"\x02\u0269\u026A\x07\n\x02\x02\u026A\u026C\x03\x02\x02\x02\u026B\u0267" +
		"\x03\x02\x02\x02\u026B\u026C\x03\x02\x02\x02\u026C\u026D\x03\x02\x02\x02" +
		"\u026D\u0272\x05\x1E\x10\x02\u026E\u026F\x07\v\x02\x02\u026F\u0271\x05" +
		"\x1E\x10\x02\u0270\u026E\x03\x02\x02\x02\u0271\u0274\x03\x02\x02\x02\u0272" +
		"\u0270\x03\x02\x02\x02\u0272\u0273\x03\x02\x02\x02\u0273\u0278\x03\x02" +
		"\x02\x02\u0274\u0272\x03\x02\x02\x02\u0275\u0277\x05\x1C\x0F\x02\u0276" +
		"\u0275\x03\x02\x02\x02\u0277\u027A\x03\x02\x02\x02\u0278\u0276\x03\x02" +
		"\x02\x02\u0278\u0279\x03\x02\x02\x02\u0279\x1B\x03\x02\x02\x02\u027A\u0278" +
		"\x03\x02\x02\x02\u027B\u027D\x07\f\x02\x02\u027C\u027E\x07\x1E\x02\x02" +
		"\u027D\u027C\x03\x02\x02\x02\u027D\u027E\x03\x02\x02\x02\u027E\u027F\x03" +
		"\x02\x02\x02\u027F\u0280\x05 \x11\x02\u0280\u0285\x05\x1E\x10\x02\u0281" +
		"\u0282\x07\v\x02\x02\u0282\u0284\x05\x1E\x10\x02\u0283\u0281\x03\x02\x02" +
		"\x02\u0284\u0287\x03\x02\x02\x02\u0285\u0283\x03\x02\x02\x02\u0285\u0286" +
		"\x03\x02\x02\x02\u0286\u0294\x03\x02\x02\x02\u0287\u0285\x03\x02\x02\x02" +
		"\u0288\u0289\x07\r\x02\x02\u0289\u028A\x05(\x15\x02\u028A\u028E\x07\x05" +
		"\x02\x02\u028B\u028D\x05\x1C\x0F\x02\u028C\u028B\x03\x02\x02\x02\u028D" +
		"\u0290\x03\x02\x02\x02\u028E\u028C\x03\x02\x02\x02\u028E\u028F\x03\x02" +
		"\x02\x02\u028F\u0291\x03\x02\x02\x02\u0290\u028E\x03\x02\x02\x02\u0291" +
		"\u0292\x07\x06\x02\x02\u0292\u0294\x03\x02\x02\x02\u0293\u027B\x03\x02" +
		"\x02\x02\u0293\u0288\x03\x02\x02\x02\u0294\x1D\x03\x02\x02\x02\u0295\u0296" +
		"\x07\x07\x02\x02\u0296\u0298\x05(\x15\x02\u0297\u0299\x07\n\x02\x02\u0298" +
		"\u0297\x03\x02\x02\x02\u0298\u0299\x03\x02\x02\x02\u0299\u029B\x03\x02" +
		"\x02\x02\u029A\u0295\x03\x02\x02\x02\u029A\u029B\x03\x02\x02\x02\u029B" +
		"\u029C\x03\x02\x02\x02\u029C\u029F\x05\"\x12\x02\u029D\u029E\x07\x11\x02" +
		"\x02\u029E\u02A0\x05(\x15\x02\u029F\u029D\x03\x02\x02\x02\u029F\u02A0" +
		"\x03\x02\x02\x02\u02A0\x1F\x03\x02\x02\x02\u02A1\u02A2\x05(\x15\x02\u02A2" +
		"!\x03\x02\x02\x02\u02A3\u02A4\x05&\x14\x02\u02A4#\x03\x02\x02\x02\u02A5" +
		"\u02A9\x05(\x15\x02\u02A6\u02A9\x05.\x18\x02\u02A7\u02A9\x05&\x14\x02" +
		"\u02A8\u02A5\x03\x02\x02\x02\u02A8\u02A6\x03\x02\x02\x02\u02A8\u02A7\x03" +
		"\x02\x02\x02\u02A9%\x03\x02\x02\x02\u02AA\u02AC\x05(\x15\x02\u02AB\u02AD" +
		"\x052\x1A\x02\u02AC\u02AB\x03\x02\x02\x02\u02AC\u02AD\x03\x02\x02\x02" +
		"\u02AD\u02AE\x03\x02\x02\x02\u02AE\u02B0\x05(\x15\x02\u02AF\u02B1\x05" +
		"2\x1A\x02\u02B0\u02AF\x03\x02\x02\x02\u02B0\u02B1\x03\x02\x02\x02\u02B1" +
		"\u02B8\x03\x02\x02\x02\u02B2\u02B4\x05(\x15\x02\u02B3\u02B5\x052\x1A\x02" +
		"\u02B4\u02B3\x03\x02\x02\x02\u02B4\u02B5\x03\x02\x02\x02\u02B5\u02B8\x03" +
		"\x02\x02\x02\u02B6\u02B8\x05.\x18\x02\u02B7\u02AA\x03\x02\x02\x02\u02B7" +
		"\u02B2\x03\x02\x02\x02\u02B7\u02B6\x03\x02\x02\x02\u02B8\'\x03\x02\x02" +
		"\x02\u02B9\u02C2\x05*\x16\x02\u02BA\u02BD\x05*\x16\x02\u02BB\u02BC\x07" +
		"C\x02\x02\u02BC\u02BE\x05*\x16\x02\u02BD\u02BB\x03\x02\x02\x02\u02BE\u02BF" +
		"\x03\x02\x02\x02\u02BF\u02BD\x03\x02\x02\x02\u02BF\u02C0\x03\x02\x02\x02" +
		"\u02C0\u02C2\x03\x02\x02\x02\u02C1\u02B9\x03\x02\x02\x02\u02C1\u02BA\x03" +
		"\x02\x02\x02\u02C2)\x03\x02\x02\x02\u02C3\u02C9\x05,\x17\x02\u02C4\u02C9" +
		"\x07@\x02\x02\u02C5\u02C9\x07>\x02\x02\u02C6\u02C9\x07F\x02\x02\u02C7" +
		"\u02C9\x07?\x02\x02\u02C8\u02C3\x03\x02\x02\x02\u02C8\u02C4\x03\x02\x02" +
		"\x02\u02C8\u02C5\x03\x02\x02\x02\u02C8\u02C6\x03\x02\x02\x02\u02C8\u02C7" +
		"\x03\x02\x02\x02\u02C9+\x03\x02\x02\x02\u02CA\u02CB\x07E\x02\x02\u02CB" +
		"-\x03\x02\x02\x02\u02CC\u02D5\x07<\x02\x02\u02CD\u02D5\x07A\x02\x02\u02CE" +
		"\u02D5\x07B\x02\x02\u02CF\u02D0\x07\x1F\x02\x02\u02D0\u02D1\x07!\x02\x02" +
		"\u02D1\u02D2\x05(\x15\x02\u02D2\u02D3\x07 \x02\x02\u02D3\u02D5\x03\x02" +
		"\x02\x02\u02D4\u02CC\x03\x02\x02\x02\u02D4\u02CD\x03\x02\x02\x02\u02D4" +
		"\u02CE\x03\x02\x02\x02\u02D4\u02CF\x03\x02\x02\x02\u02D5/\x03\x02\x02" +
		"\x02\u02D6\u02D7\x07<\x02\x02\u02D71\x03\x02\x02\x02\u02D8\u02D9\x07=" +
		"\x02\x02\u02D93\x03\x02\x02\x02`9AFKQX^glo}\x86\x89\x8C\x94\x9B\xA1\xA5" +
		"\xAA\xB6\xBC\xC6\xCD\xD0\xD5\xDE\xE6\xEE\xF7\xFF\u0108\u0111\u0119\u0122" +
		"\u012B\u0133\u013B\u0145\u015B\u0161\u016B\u0175\u017F\u0185\u018F\u0195" +
		"\u019F\u01A5\u01AF\u01B5\u01B8\u01BF\u01C6\u01CA\u01CD\u01D6\u01DC\u01E6" +
		"\u01F3\u01F9\u01FE\u0205\u020A\u0211\u0218\u021F\u0226\u022B\u0231\u0237" +
		"\u0243\u024A\u0254\u0257\u0265\u026B\u0272\u0278\u027D\u0285\u028E\u0293" +
		"\u0298\u029A\u029F\u02A8\u02AC\u02B0\u02B4\u02B7\u02BF\u02C1\u02C8\u02D4";
	public static readonly _serializedATN: string = Utils.join(
		[
			DParser._serializedATNSegment0,
			DParser._serializedATNSegment1,
		],
		"",
	);
	public static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!DParser.__ATN) {
			DParser.__ATN = new ATNDeserializer().deserialize(Utils.toCharArray(DParser._serializedATN));
		}

		return DParser.__ATN;
	}

}

export class RootRuleContext extends ParserRuleContext {
	public dFileRule(): DFileRuleContext {
		return this.getRuleContext(0, DFileRuleContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_rootRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterRootRule) {
			listener.enterRootRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitRootRule) {
			listener.exitRootRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitRootRule) {
			return visitor.visitRootRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DFileRuleContext extends ParserRuleContext {
	public _dActionRule!: DActionRuleContext;
	public _actions: DActionRuleContext[] = [];
	public EOF(): TerminalNode { return this.getToken(DParser.EOF, 0); }
	public dActionRule(): DActionRuleContext[];
	public dActionRule(i: number): DActionRuleContext;
	public dActionRule(i?: number): DActionRuleContext | DActionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(DActionRuleContext);
		} else {
			return this.getRuleContext(i, DActionRuleContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_dFileRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterDFileRule) {
			listener.enterDFileRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitDFileRule) {
			listener.exitDFileRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitDFileRule) {
			return visitor.visitDFileRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DActionRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_dActionRule; }
	public copyFrom(ctx: DActionRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class BeginDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _nonPausing!: StringRuleContext;
	public _stateRule!: StateRuleContext;
	public _states: StateRuleContext[] = [];
	public BEGIN(): TerminalNode { return this.getToken(DParser.BEGIN, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext | undefined {
		return this.tryGetRuleContext(0, StringRuleContext);
	}
	public stateRule(): StateRuleContext[];
	public stateRule(i: number): StateRuleContext;
	public stateRule(i?: number): StateRuleContext | StateRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StateRuleContext);
		} else {
			return this.getRuleContext(i, StateRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterBeginDAction) {
			listener.enterBeginDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitBeginDAction) {
			listener.exitBeginDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitBeginDAction) {
			return visitor.visitBeginDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AppendDActionContext extends DActionRuleContext {
	public _ifExists!: Token;
	public _dlg!: FileRuleContext;
	public _stateRule!: StateRuleContext;
	public _states: StateRuleContext[] = [];
	public APPEND(): TerminalNode { return this.getToken(DParser.APPEND, 0); }
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public IF_FILE_EXISTS(): TerminalNode | undefined { return this.tryGetToken(DParser.IF_FILE_EXISTS, 0); }
	public stateRule(): StateRuleContext[];
	public stateRule(i: number): StateRuleContext;
	public stateRule(i?: number): StateRuleContext | StateRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StateRuleContext);
		} else {
			return this.getRuleContext(i, StateRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAppendDAction) {
			listener.enterAppendDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAppendDAction) {
			listener.exitAppendDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAppendDAction) {
			return visitor.visitAppendDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AppendEarlyDActionContext extends DActionRuleContext {
	public _ifExists!: Token;
	public _dlg!: FileRuleContext;
	public _stateRule!: StateRuleContext;
	public _states: StateRuleContext[] = [];
	public APPEND_EARLY(): TerminalNode { return this.getToken(DParser.APPEND_EARLY, 0); }
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public IF_FILE_EXISTS(): TerminalNode | undefined { return this.tryGetToken(DParser.IF_FILE_EXISTS, 0); }
	public stateRule(): StateRuleContext[];
	public stateRule(i: number): StateRuleContext;
	public stateRule(i?: number): StateRuleContext | StateRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StateRuleContext);
		} else {
			return this.getRuleContext(i, StateRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAppendEarlyDAction) {
			listener.enterAppendEarlyDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAppendEarlyDAction) {
			listener.exitAppendEarlyDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAppendEarlyDAction) {
			return visitor.visitAppendEarlyDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ChainDActionContext extends DActionRuleContext {
	public _weight!: SharpNumberRuleContext;
	public _trigger!: StringRuleContext;
	public _ifExists!: Token;
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public _body!: ChainDlgRuleContext;
	public _epilog!: ChainActionEpilogRuleContext;
	public CHAIN(): TerminalNode { return this.getToken(DParser.CHAIN, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public chainDlgRule(): ChainDlgRuleContext {
		return this.getRuleContext(0, ChainDlgRuleContext);
	}
	public chainActionEpilogRule(): ChainActionEpilogRuleContext {
		return this.getRuleContext(0, ChainActionEpilogRuleContext);
	}
	public IF(): TerminalNode | undefined { return this.tryGetToken(DParser.IF, 0); }
	public THEN(): TerminalNode | undefined { return this.tryGetToken(DParser.THEN, 0); }
	public IF_FILE_EXISTS(): TerminalNode | undefined { return this.tryGetToken(DParser.IF_FILE_EXISTS, 0); }
	public WEIGHT(): TerminalNode | undefined { return this.tryGetToken(DParser.WEIGHT, 0); }
	public sharpNumberRule(): SharpNumberRuleContext | undefined {
		return this.tryGetRuleContext(0, SharpNumberRuleContext);
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterChainDAction) {
			listener.enterChainDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitChainDAction) {
			listener.exitChainDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitChainDAction) {
			return visitor.visitChainDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class InterjectDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public _globalVar!: StringRuleContext;
	public _chainBlockRule!: ChainBlockRuleContext;
	public _blocks: ChainBlockRuleContext[] = [];
	public _epilog!: ChainActionEpilogRuleContext;
	public INTERJECT(): TerminalNode { return this.getToken(DParser.INTERJECT, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public chainActionEpilogRule(): ChainActionEpilogRuleContext {
		return this.getRuleContext(0, ChainActionEpilogRuleContext);
	}
	public chainBlockRule(): ChainBlockRuleContext[];
	public chainBlockRule(i: number): ChainBlockRuleContext;
	public chainBlockRule(i?: number): ChainBlockRuleContext | ChainBlockRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ChainBlockRuleContext);
		} else {
			return this.getRuleContext(i, ChainBlockRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterInterjectDAction) {
			listener.enterInterjectDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitInterjectDAction) {
			listener.exitInterjectDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitInterjectDAction) {
			return visitor.visitInterjectDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class InterjectCopyTransDActionContext extends DActionRuleContext {
	public _v1!: Token;
	public _v2!: Token;
	public _v3!: Token;
	public _v4!: Token;
	public _safe!: Token;
	public _ifExists!: Token;
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public _globalVar!: StringRuleContext;
	public _chainBlockRule!: ChainBlockRuleContext;
	public _blocks: ChainBlockRuleContext[] = [];
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public INTERJECT_COPY_TRANS(): TerminalNode | undefined { return this.tryGetToken(DParser.INTERJECT_COPY_TRANS, 0); }
	public INTERJECT_COPY_TRANS2(): TerminalNode | undefined { return this.tryGetToken(DParser.INTERJECT_COPY_TRANS2, 0); }
	public INTERJECT_COPY_TRANS3(): TerminalNode | undefined { return this.tryGetToken(DParser.INTERJECT_COPY_TRANS3, 0); }
	public INTERJECT_COPY_TRANS4(): TerminalNode | undefined { return this.tryGetToken(DParser.INTERJECT_COPY_TRANS4, 0); }
	public SAFE(): TerminalNode | undefined { return this.tryGetToken(DParser.SAFE, 0); }
	public IF_FILE_EXISTS(): TerminalNode | undefined { return this.tryGetToken(DParser.IF_FILE_EXISTS, 0); }
	public chainBlockRule(): ChainBlockRuleContext[];
	public chainBlockRule(i: number): ChainBlockRuleContext;
	public chainBlockRule(i?: number): ChainBlockRuleContext | ChainBlockRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ChainBlockRuleContext);
		} else {
			return this.getRuleContext(i, ChainBlockRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterInterjectCopyTransDAction) {
			listener.enterInterjectCopyTransDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitInterjectCopyTransDAction) {
			listener.exitInterjectCopyTransDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitInterjectCopyTransDAction) {
			return visitor.visitInterjectCopyTransDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExtendTopBottomDActionContext extends DActionRuleContext {
	public _top!: Token;
	public _bottom!: Token;
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _states: StringRuleContext[] = [];
	public _position!: SharpNumberRuleContext;
	public _transitionRule!: TransitionRuleContext;
	public _transitions: TransitionRuleContext[] = [];
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public EXTEND_TOP(): TerminalNode | undefined { return this.tryGetToken(DParser.EXTEND_TOP, 0); }
	public EXTEND_BOTTOM(): TerminalNode | undefined { return this.tryGetToken(DParser.EXTEND_BOTTOM, 0); }
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public sharpNumberRule(): SharpNumberRuleContext | undefined {
		return this.tryGetRuleContext(0, SharpNumberRuleContext);
	}
	public transitionRule(): TransitionRuleContext[];
	public transitionRule(i: number): TransitionRuleContext;
	public transitionRule(i?: number): TransitionRuleContext | TransitionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(TransitionRuleContext);
		} else {
			return this.getRuleContext(i, TransitionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterExtendTopBottomDAction) {
			listener.enterExtendTopBottomDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitExtendTopBottomDAction) {
			listener.exitExtendTopBottomDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitExtendTopBottomDAction) {
			return visitor.visitExtendTopBottomDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AddStateTriggerDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _labels: StringRuleContext[] = [];
	public _trigger!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public ADD_STATE_TRIGGER(): TerminalNode { return this.getToken(DParser.ADD_STATE_TRIGGER, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAddStateTriggerDAction) {
			listener.enterAddStateTriggerDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAddStateTriggerDAction) {
			listener.exitAddStateTriggerDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAddStateTriggerDAction) {
			return visitor.visitAddStateTriggerDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AddTransTriggerDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _labels: StringRuleContext[] = [];
	public _trigger!: StringRuleContext;
	public _tras: StringRuleContext[] = [];
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public ADD_TRANS_TRIGGER(): TerminalNode { return this.getToken(DParser.ADD_TRANS_TRIGGER, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public DO(): TerminalNode | undefined { return this.tryGetToken(DParser.DO, 0); }
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAddTransTriggerDAction) {
			listener.enterAddTransTriggerDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAddTransTriggerDAction) {
			listener.exitAddTransTriggerDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAddTransTriggerDAction) {
			return visitor.visitAddTransTriggerDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AddTransActionDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _labels: StringRuleContext[] = [];
	public _tras: StringRuleContext[] = [];
	public _action!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public ADD_TRANS_ACTION(): TerminalNode { return this.getToken(DParser.ADD_TRANS_ACTION, 0); }
	public BEGIN(): TerminalNode[];
	public BEGIN(i: number): TerminalNode;
	public BEGIN(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.BEGIN);
		} else {
			return this.getToken(DParser.BEGIN, i);
		}
	}
	public END(): TerminalNode[];
	public END(i: number): TerminalNode;
	public END(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.END);
		} else {
			return this.getToken(DParser.END, i);
		}
	}
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAddTransActionDAction) {
			listener.enterAddTransActionDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAddTransActionDAction) {
			listener.exitAddTransActionDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAddTransActionDAction) {
			return visitor.visitAddTransActionDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceTransActionDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _labels: StringRuleContext[] = [];
	public _tras: StringRuleContext[] = [];
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_TRANS_ACTION(): TerminalNode { return this.getToken(DParser.REPLACE_TRANS_ACTION, 0); }
	public BEGIN(): TerminalNode[];
	public BEGIN(i: number): TerminalNode;
	public BEGIN(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.BEGIN);
		} else {
			return this.getToken(DParser.BEGIN, i);
		}
	}
	public END(): TerminalNode[];
	public END(i: number): TerminalNode;
	public END(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.END);
		} else {
			return this.getToken(DParser.END, i);
		}
	}
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceTransActionDAction) {
			listener.enterReplaceTransActionDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceTransActionDAction) {
			listener.exitReplaceTransActionDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceTransActionDAction) {
			return visitor.visitReplaceTransActionDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceTransTriggerDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _labels: StringRuleContext[] = [];
	public _tras: StringRuleContext[] = [];
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_TRANS_TRIGGER(): TerminalNode { return this.getToken(DParser.REPLACE_TRANS_TRIGGER, 0); }
	public BEGIN(): TerminalNode[];
	public BEGIN(i: number): TerminalNode;
	public BEGIN(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.BEGIN);
		} else {
			return this.getToken(DParser.BEGIN, i);
		}
	}
	public END(): TerminalNode[];
	public END(i: number): TerminalNode;
	public END(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.END);
		} else {
			return this.getToken(DParser.END, i);
		}
	}
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceTransTriggerDAction) {
			listener.enterReplaceTransTriggerDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceTransTriggerDAction) {
			listener.exitReplaceTransTriggerDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceTransTriggerDAction) {
			return visitor.visitReplaceTransTriggerDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AlterTransDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _labels: StringRuleContext[] = [];
	public _tras: StringRuleContext[] = [];
	public _alterTransCommand!: AlterTransCommandContext;
	public _changes: AlterTransCommandContext[] = [];
	public ALTER_TRANS(): TerminalNode { return this.getToken(DParser.ALTER_TRANS, 0); }
	public BEGIN(): TerminalNode[];
	public BEGIN(i: number): TerminalNode;
	public BEGIN(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.BEGIN);
		} else {
			return this.getToken(DParser.BEGIN, i);
		}
	}
	public END(): TerminalNode[];
	public END(i: number): TerminalNode;
	public END(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.END);
		} else {
			return this.getToken(DParser.END, i);
		}
	}
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public alterTransCommand(): AlterTransCommandContext[];
	public alterTransCommand(i: number): AlterTransCommandContext;
	public alterTransCommand(i?: number): AlterTransCommandContext | AlterTransCommandContext[] {
		if (i === undefined) {
			return this.getRuleContexts(AlterTransCommandContext);
		} else {
			return this.getRuleContext(i, AlterTransCommandContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAlterTransDAction) {
			listener.enterAlterTransDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAlterTransDAction) {
			listener.exitAlterTransDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAlterTransDAction) {
			return visitor.visitAlterTransDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stateRule!: StateRuleContext;
	public _newStates: StateRuleContext[] = [];
	public REPLACE(): TerminalNode { return this.getToken(DParser.REPLACE, 0); }
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stateRule(): StateRuleContext[];
	public stateRule(i: number): StateRuleContext;
	public stateRule(i?: number): StateRuleContext | StateRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StateRuleContext);
		} else {
			return this.getRuleContext(i, StateRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceDAction) {
			listener.enterReplaceDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceDAction) {
			listener.exitReplaceDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceDAction) {
			return visitor.visitReplaceDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class SetWeightDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public _weight!: SharpNumberRuleContext;
	public SET_WEIGHT(): TerminalNode { return this.getToken(DParser.SET_WEIGHT, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public sharpNumberRule(): SharpNumberRuleContext {
		return this.getRuleContext(0, SharpNumberRuleContext);
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterSetWeightDAction) {
			listener.enterSetWeightDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitSetWeightDAction) {
			listener.exitSetWeightDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitSetWeightDAction) {
			return visitor.visitSetWeightDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceSayDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public _newVal!: SayTextRuleContext;
	public REPLACE_SAY(): TerminalNode { return this.getToken(DParser.REPLACE_SAY, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public sayTextRule(): SayTextRuleContext {
		return this.getRuleContext(0, SayTextRuleContext);
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceSayDAction) {
			listener.enterReplaceSayDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceSayDAction) {
			listener.exitReplaceSayDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceSayDAction) {
			return visitor.visitReplaceSayDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceStateTriggerDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _stringRule!: StringRuleContext;
	public _labels: StringRuleContext[] = [];
	public _trigger!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_STATE_TRIGGER(): TerminalNode { return this.getToken(DParser.REPLACE_STATE_TRIGGER, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceStateTriggerDAction) {
			listener.enterReplaceStateTriggerDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceStateTriggerDAction) {
			listener.exitReplaceStateTriggerDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceStateTriggerDAction) {
			return visitor.visitReplaceStateTriggerDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceTriggerTextDActionContext extends DActionRuleContext {
	public _dlg!: FileRuleContext;
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_TRIGGER_TEXT(): TerminalNode { return this.getToken(DParser.REPLACE_TRIGGER_TEXT, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceTriggerTextDAction) {
			listener.enterReplaceTriggerTextDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceTriggerTextDAction) {
			listener.exitReplaceTriggerTextDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceTriggerTextDAction) {
			return visitor.visitReplaceTriggerTextDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceTriggerTextRegexpDActionContext extends DActionRuleContext {
	public _dlgRegexp!: StringRuleContext;
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_TRIGGER_TEXT_REGEXP(): TerminalNode { return this.getToken(DParser.REPLACE_TRIGGER_TEXT_REGEXP, 0); }
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceTriggerTextRegexpDAction) {
			listener.enterReplaceTriggerTextRegexpDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceTriggerTextRegexpDAction) {
			listener.exitReplaceTriggerTextRegexpDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceTriggerTextRegexpDAction) {
			return visitor.visitReplaceTriggerTextRegexpDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceActionTextDActionContext extends DActionRuleContext {
	public _fileRule!: FileRuleContext;
	public _dlgs: FileRuleContext[] = [];
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_ACTION_TEXT(): TerminalNode { return this.getToken(DParser.REPLACE_ACTION_TEXT, 0); }
	public fileRule(): FileRuleContext[];
	public fileRule(i: number): FileRuleContext;
	public fileRule(i?: number): FileRuleContext | FileRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FileRuleContext);
		} else {
			return this.getRuleContext(i, FileRuleContext);
		}
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceActionTextDAction) {
			listener.enterReplaceActionTextDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceActionTextDAction) {
			listener.exitReplaceActionTextDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceActionTextDAction) {
			return visitor.visitReplaceActionTextDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceActionTextRegexpDActionContext extends DActionRuleContext {
	public _stringRule!: StringRuleContext;
	public _dlgRegexps: StringRuleContext[] = [];
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_ACTION_TEXT_REGEXP(): TerminalNode { return this.getToken(DParser.REPLACE_ACTION_TEXT_REGEXP, 0); }
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceActionTextRegexpDAction) {
			listener.enterReplaceActionTextRegexpDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceActionTextRegexpDAction) {
			listener.exitReplaceActionTextRegexpDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceActionTextRegexpDAction) {
			return visitor.visitReplaceActionTextRegexpDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceActionTextProcessDActionContext extends DActionRuleContext {
	public _fileRule!: FileRuleContext;
	public _dlgs: FileRuleContext[] = [];
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_ACTION_TEXT_PROCESS(): TerminalNode { return this.getToken(DParser.REPLACE_ACTION_TEXT_PROCESS, 0); }
	public fileRule(): FileRuleContext[];
	public fileRule(i: number): FileRuleContext;
	public fileRule(i?: number): FileRuleContext | FileRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FileRuleContext);
		} else {
			return this.getRuleContext(i, FileRuleContext);
		}
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceActionTextProcessDAction) {
			listener.enterReplaceActionTextProcessDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceActionTextProcessDAction) {
			listener.exitReplaceActionTextProcessDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceActionTextProcessDAction) {
			return visitor.visitReplaceActionTextProcessDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplaceActionTextProcessRegexpDActionContext extends DActionRuleContext {
	public _stringRule!: StringRuleContext;
	public _dlgRegexps: StringRuleContext[] = [];
	public _oldText!: StringRuleContext;
	public _newText!: StringRuleContext;
	public _conditionRule!: ConditionRuleContext;
	public _conditions: ConditionRuleContext[] = [];
	public REPLACE_ACTION_TEXT_PROCESS_REGEXP(): TerminalNode { return this.getToken(DParser.REPLACE_ACTION_TEXT_PROCESS_REGEXP, 0); }
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public conditionRule(): ConditionRuleContext[];
	public conditionRule(i: number): ConditionRuleContext;
	public conditionRule(i?: number): ConditionRuleContext | ConditionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConditionRuleContext);
		} else {
			return this.getRuleContext(i, ConditionRuleContext);
		}
	}
	constructor(ctx: DActionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplaceActionTextProcessRegexpDAction) {
			listener.enterReplaceActionTextProcessRegexpDAction(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplaceActionTextProcessRegexpDAction) {
			listener.exitReplaceActionTextProcessRegexpDAction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplaceActionTextProcessRegexpDAction) {
			return visitor.visitReplaceActionTextProcessRegexpDAction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AlterTransCommandContext extends ParserRuleContext {
	public _type!: StringRuleContext;
	public _newVal!: StringRuleContext;
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_alterTransCommand; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAlterTransCommand) {
			listener.enterAlterTransCommand(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAlterTransCommand) {
			listener.exitAlterTransCommand(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAlterTransCommand) {
			return visitor.visitAlterTransCommand(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConditionRuleContext extends ParserRuleContext {
	public _isIf!: Token;
	public _isUnless!: Token;
	public _predicate!: StringRuleContext;
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public IF(): TerminalNode | undefined { return this.tryGetToken(DParser.IF, 0); }
	public UNLESS(): TerminalNode | undefined { return this.tryGetToken(DParser.UNLESS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_conditionRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterConditionRule) {
			listener.enterConditionRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitConditionRule) {
			listener.exitConditionRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitConditionRule) {
			return visitor.visitConditionRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StateRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_stateRule; }
	public copyFrom(ctx: StateRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class IfThenStateContext extends StateRuleContext {
	public _weight!: SharpNumberRuleContext;
	public _trigger!: StringRuleContext;
	public _label!: StringRuleContext;
	public _sayTextRule!: SayTextRuleContext;
	public _lines: SayTextRuleContext[] = [];
	public _transitionRule!: TransitionRuleContext;
	public _transitions: TransitionRuleContext[] = [];
	public IF(): TerminalNode { return this.getToken(DParser.IF, 0); }
	public SAY(): TerminalNode { return this.getToken(DParser.SAY, 0); }
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public sayTextRule(): SayTextRuleContext[];
	public sayTextRule(i: number): SayTextRuleContext;
	public sayTextRule(i?: number): SayTextRuleContext | SayTextRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(SayTextRuleContext);
		} else {
			return this.getRuleContext(i, SayTextRuleContext);
		}
	}
	public WEIGHT(): TerminalNode | undefined { return this.tryGetToken(DParser.WEIGHT, 0); }
	public THEN(): TerminalNode | undefined { return this.tryGetToken(DParser.THEN, 0); }
	public BEGIN(): TerminalNode | undefined { return this.tryGetToken(DParser.BEGIN, 0); }
	public EQ(): TerminalNode[];
	public EQ(i: number): TerminalNode;
	public EQ(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.EQ);
		} else {
			return this.getToken(DParser.EQ, i);
		}
	}
	public sharpNumberRule(): SharpNumberRuleContext | undefined {
		return this.tryGetRuleContext(0, SharpNumberRuleContext);
	}
	public transitionRule(): TransitionRuleContext[];
	public transitionRule(i: number): TransitionRuleContext;
	public transitionRule(i?: number): TransitionRuleContext | TransitionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(TransitionRuleContext);
		} else {
			return this.getRuleContext(i, TransitionRuleContext);
		}
	}
	constructor(ctx: StateRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterIfThenState) {
			listener.enterIfThenState(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitIfThenState) {
			listener.exitIfThenState(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitIfThenState) {
			return visitor.visitIfThenState(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AppendiStateContext extends StateRuleContext {
	public _dlg!: FileRuleContext;
	public _stateRule!: StateRuleContext;
	public _states: StateRuleContext[] = [];
	public APPENDI(): TerminalNode { return this.getToken(DParser.APPENDI, 0); }
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stateRule(): StateRuleContext[];
	public stateRule(i: number): StateRuleContext;
	public stateRule(i?: number): StateRuleContext | StateRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StateRuleContext);
		} else {
			return this.getRuleContext(i, StateRuleContext);
		}
	}
	constructor(ctx: StateRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterAppendiState) {
			listener.enterAppendiState(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitAppendiState) {
			listener.exitAppendiState(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitAppendiState) {
			return visitor.visitAppendiState(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class Chain2StateContext extends StateRuleContext {
	public _dlg!: FileRuleContext;
	public _entryLabel!: StringRuleContext;
	public _body!: Chain2DlgRuleContext;
	public _exitDlg!: FileRuleContext;
	public _exitLabel!: StringRuleContext;
	public CHAIN2(): TerminalNode { return this.getToken(DParser.CHAIN2, 0); }
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext[];
	public fileRule(i: number): FileRuleContext;
	public fileRule(i?: number): FileRuleContext | FileRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FileRuleContext);
		} else {
			return this.getRuleContext(i, FileRuleContext);
		}
	}
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public chain2DlgRule(): Chain2DlgRuleContext {
		return this.getRuleContext(0, Chain2DlgRuleContext);
	}
	constructor(ctx: StateRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterChain2State) {
			listener.enterChain2State(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitChain2State) {
			listener.exitChain2State(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitChain2State) {
			return visitor.visitChain2State(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class Chain2DlgRuleContext extends ParserRuleContext {
	public _initialLine!: ChainElementRuleContext;
	public _chain2ElementRule!: Chain2ElementRuleContext;
	public _restLines: Chain2ElementRuleContext[] = [];
	public chainElementRule(): ChainElementRuleContext {
		return this.getRuleContext(0, ChainElementRuleContext);
	}
	public chain2ElementRule(): Chain2ElementRuleContext[];
	public chain2ElementRule(i: number): Chain2ElementRuleContext;
	public chain2ElementRule(i?: number): Chain2ElementRuleContext | Chain2ElementRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(Chain2ElementRuleContext);
		} else {
			return this.getRuleContext(i, Chain2ElementRuleContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_chain2DlgRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterChain2DlgRule) {
			listener.enterChain2DlgRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitChain2DlgRule) {
			listener.exitChain2DlgRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitChain2DlgRule) {
			return visitor.visitChain2DlgRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class Chain2ElementRuleContext extends ParserRuleContext {
	public _operator!: Token;
	public _line!: ChainElementRuleContext;
	public chainElementRule(): ChainElementRuleContext {
		return this.getRuleContext(0, ChainElementRuleContext);
	}
	public EQEQ(): TerminalNode | undefined { return this.tryGetToken(DParser.EQEQ, 0); }
	public EQ(): TerminalNode | undefined { return this.tryGetToken(DParser.EQ, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_chain2ElementRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterChain2ElementRule) {
			listener.enterChain2ElementRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitChain2ElementRule) {
			listener.exitChain2ElementRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitChain2ElementRule) {
			return visitor.visitChain2ElementRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TransitionRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_transitionRule; }
	public copyFrom(ctx: TransitionRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class IfThenTransitionContext extends TransitionRuleContext {
	public _trigger!: StringRuleContext;
	public _transitionFeatureRule!: TransitionFeatureRuleContext;
	public _features: TransitionFeatureRuleContext[] = [];
	public _transitionTargetRule!: TransitionTargetRuleContext;
	public _out: TransitionTargetRuleContext[] = [];
	public IF(): TerminalNode { return this.getToken(DParser.IF, 0); }
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public transitionTargetRule(): TransitionTargetRuleContext {
		return this.getRuleContext(0, TransitionTargetRuleContext);
	}
	public THEN(): TerminalNode | undefined { return this.tryGetToken(DParser.THEN, 0); }
	public transitionFeatureRule(): TransitionFeatureRuleContext[];
	public transitionFeatureRule(i: number): TransitionFeatureRuleContext;
	public transitionFeatureRule(i?: number): TransitionFeatureRuleContext | TransitionFeatureRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(TransitionFeatureRuleContext);
		} else {
			return this.getRuleContext(i, TransitionFeatureRuleContext);
		}
	}
	constructor(ctx: TransitionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterIfThenTransition) {
			listener.enterIfThenTransition(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitIfThenTransition) {
			listener.exitIfThenTransition(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitIfThenTransition) {
			return visitor.visitIfThenTransition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReplyTransitionContext extends TransitionRuleContext {
	public _trigger!: StringRuleContext;
	public _reply!: SayTextRuleContext;
	public _transitionFeatureRule!: TransitionFeatureRuleContext;
	public _features: TransitionFeatureRuleContext[] = [];
	public _transitionTargetRule!: TransitionTargetRuleContext;
	public _out: TransitionTargetRuleContext[] = [];
	public PLUS(): TerminalNode[];
	public PLUS(i: number): TerminalNode;
	public PLUS(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.PLUS);
		} else {
			return this.getToken(DParser.PLUS, i);
		}
	}
	public sayTextRule(): SayTextRuleContext {
		return this.getRuleContext(0, SayTextRuleContext);
	}
	public transitionTargetRule(): TransitionTargetRuleContext {
		return this.getRuleContext(0, TransitionTargetRuleContext);
	}
	public stringRule(): StringRuleContext | undefined {
		return this.tryGetRuleContext(0, StringRuleContext);
	}
	public transitionFeatureRule(): TransitionFeatureRuleContext[];
	public transitionFeatureRule(i: number): TransitionFeatureRuleContext;
	public transitionFeatureRule(i?: number): TransitionFeatureRuleContext | TransitionFeatureRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(TransitionFeatureRuleContext);
		} else {
			return this.getRuleContext(i, TransitionFeatureRuleContext);
		}
	}
	constructor(ctx: TransitionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplyTransition) {
			listener.enterReplyTransition(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplyTransition) {
			listener.exitReplyTransition(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplyTransition) {
			return visitor.visitReplyTransition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class CopyTransTransitionContext extends TransitionRuleContext {
	public _safe!: Token;
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public COPY_TRANS(): TerminalNode { return this.getToken(DParser.COPY_TRANS, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public SAFE(): TerminalNode | undefined { return this.tryGetToken(DParser.SAFE, 0); }
	constructor(ctx: TransitionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterCopyTransTransition) {
			listener.enterCopyTransTransition(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitCopyTransTransition) {
			listener.exitCopyTransTransition(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitCopyTransTransition) {
			return visitor.visitCopyTransTransition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class CopyTransLateTransitionContext extends TransitionRuleContext {
	public _safe!: Token;
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public COPY_TRANS_LATE(): TerminalNode { return this.getToken(DParser.COPY_TRANS_LATE, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public SAFE(): TerminalNode | undefined { return this.tryGetToken(DParser.SAFE, 0); }
	constructor(ctx: TransitionRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterCopyTransLateTransition) {
			listener.enterCopyTransLateTransition(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitCopyTransLateTransition) {
			listener.exitCopyTransLateTransition(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitCopyTransLateTransition) {
			return visitor.visitCopyTransLateTransition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TransitionTargetRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_transitionTargetRule; }
	public copyFrom(ctx: TransitionTargetRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class GotoTransitionTargetContext extends TransitionTargetRuleContext {
	public _label!: StringRuleContext;
	public GOTO(): TerminalNode | undefined { return this.tryGetToken(DParser.GOTO, 0); }
	public PLUS(): TerminalNode | undefined { return this.tryGetToken(DParser.PLUS, 0); }
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	constructor(ctx: TransitionTargetRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterGotoTransitionTarget) {
			listener.enterGotoTransitionTarget(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitGotoTransitionTarget) {
			listener.exitGotoTransitionTarget(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitGotoTransitionTarget) {
			return visitor.visitGotoTransitionTarget(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExternTransitionTargetContext extends TransitionTargetRuleContext {
	public _ifExists!: Token;
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public EXTERN(): TerminalNode { return this.getToken(DParser.EXTERN, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public IF_FILE_EXISTS(): TerminalNode | undefined { return this.tryGetToken(DParser.IF_FILE_EXISTS, 0); }
	constructor(ctx: TransitionTargetRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterExternTransitionTarget) {
			listener.enterExternTransitionTarget(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitExternTransitionTarget) {
			listener.exitExternTransitionTarget(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitExternTransitionTarget) {
			return visitor.visitExternTransitionTarget(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExitTransitionTargetContext extends TransitionTargetRuleContext {
	public EXIT(): TerminalNode { return this.getToken(DParser.EXIT, 0); }
	constructor(ctx: TransitionTargetRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterExitTransitionTarget) {
			listener.enterExitTransitionTarget(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitExitTransitionTarget) {
			listener.exitExitTransitionTarget(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitExitTransitionTarget) {
			return visitor.visitExitTransitionTarget(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ChainActionEpilogRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_chainActionEpilogRule; }
	public copyFrom(ctx: ChainActionEpilogRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class EndChainActionEpilogContext extends ChainActionEpilogRuleContext {
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	constructor(ctx: ChainActionEpilogRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterEndChainActionEpilog) {
			listener.enterEndChainActionEpilog(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitEndChainActionEpilog) {
			listener.exitEndChainActionEpilog(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitEndChainActionEpilog) {
			return visitor.visitEndChainActionEpilog(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExternChainActionEpilogContext extends ChainActionEpilogRuleContext {
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public EXTERN(): TerminalNode { return this.getToken(DParser.EXTERN, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	constructor(ctx: ChainActionEpilogRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterExternChainActionEpilog) {
			listener.enterExternChainActionEpilog(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitExternChainActionEpilog) {
			listener.exitExternChainActionEpilog(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitExternChainActionEpilog) {
			return visitor.visitExternChainActionEpilog(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class CopyTransChainActionEpilogContext extends ChainActionEpilogRuleContext {
	public _safe!: Token;
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public COPY_TRANS(): TerminalNode { return this.getToken(DParser.COPY_TRANS, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public SAFE(): TerminalNode | undefined { return this.tryGetToken(DParser.SAFE, 0); }
	constructor(ctx: ChainActionEpilogRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterCopyTransChainActionEpilog) {
			listener.enterCopyTransChainActionEpilog(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitCopyTransChainActionEpilog) {
			listener.exitCopyTransChainActionEpilog(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitCopyTransChainActionEpilog) {
			return visitor.visitCopyTransChainActionEpilog(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class CopyTransLateChainActionEpilogContext extends ChainActionEpilogRuleContext {
	public _safe!: Token;
	public _dlg!: FileRuleContext;
	public _label!: StringRuleContext;
	public COPY_TRANS_LATE(): TerminalNode { return this.getToken(DParser.COPY_TRANS_LATE, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public SAFE(): TerminalNode | undefined { return this.tryGetToken(DParser.SAFE, 0); }
	constructor(ctx: ChainActionEpilogRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterCopyTransLateChainActionEpilog) {
			listener.enterCopyTransLateChainActionEpilog(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitCopyTransLateChainActionEpilog) {
			listener.exitCopyTransLateChainActionEpilog(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitCopyTransLateChainActionEpilog) {
			return visitor.visitCopyTransLateChainActionEpilog(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExitChainActionEpilogContext extends ChainActionEpilogRuleContext {
	public EXIT(): TerminalNode { return this.getToken(DParser.EXIT, 0); }
	constructor(ctx: ChainActionEpilogRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterExitChainActionEpilog) {
			listener.enterExitChainActionEpilog(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitExitChainActionEpilog) {
			listener.exitExitChainActionEpilog(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitExitChainActionEpilog) {
			return visitor.visitExitChainActionEpilog(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class EndWithTransitionsChainActionEpilogContext extends ChainActionEpilogRuleContext {
	public _transitionRule!: TransitionRuleContext;
	public _transitions: TransitionRuleContext[] = [];
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public transitionRule(): TransitionRuleContext[];
	public transitionRule(i: number): TransitionRuleContext;
	public transitionRule(i?: number): TransitionRuleContext | TransitionRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(TransitionRuleContext);
		} else {
			return this.getRuleContext(i, TransitionRuleContext);
		}
	}
	constructor(ctx: ChainActionEpilogRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterEndWithTransitionsChainActionEpilog) {
			listener.enterEndWithTransitionsChainActionEpilog(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitEndWithTransitionsChainActionEpilog) {
			listener.exitEndWithTransitionsChainActionEpilog(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitEndWithTransitionsChainActionEpilog) {
			return visitor.visitEndWithTransitionsChainActionEpilog(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TransitionFeatureRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_transitionFeatureRule; }
	public copyFrom(ctx: TransitionFeatureRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class ReplyTransitionFeatureContext extends TransitionFeatureRuleContext {
	public _line!: DlgLineRuleContext;
	public REPLY(): TerminalNode { return this.getToken(DParser.REPLY, 0); }
	public dlgLineRule(): DlgLineRuleContext {
		return this.getRuleContext(0, DlgLineRuleContext);
	}
	constructor(ctx: TransitionFeatureRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReplyTransitionFeature) {
			listener.enterReplyTransitionFeature(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReplyTransitionFeature) {
			listener.exitReplyTransitionFeature(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReplyTransitionFeature) {
			return visitor.visitReplyTransitionFeature(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DoTransitionFeatureContext extends TransitionFeatureRuleContext {
	public _action!: StringRuleContext;
	public DO(): TerminalNode { return this.getToken(DParser.DO, 0); }
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	constructor(ctx: TransitionFeatureRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterDoTransitionFeature) {
			listener.enterDoTransitionFeature(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitDoTransitionFeature) {
			listener.exitDoTransitionFeature(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitDoTransitionFeature) {
			return visitor.visitDoTransitionFeature(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class JournalTransitionFeatureContext extends TransitionFeatureRuleContext {
	public _entry!: DlgLineRuleContext;
	public JOURNAL(): TerminalNode { return this.getToken(DParser.JOURNAL, 0); }
	public dlgLineRule(): DlgLineRuleContext {
		return this.getRuleContext(0, DlgLineRuleContext);
	}
	constructor(ctx: TransitionFeatureRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterJournalTransitionFeature) {
			listener.enterJournalTransitionFeature(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitJournalTransitionFeature) {
			listener.exitJournalTransitionFeature(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitJournalTransitionFeature) {
			return visitor.visitJournalTransitionFeature(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class SolvedJournalTransitionFeatureContext extends TransitionFeatureRuleContext {
	public _entry!: DlgLineRuleContext;
	public SOLVED_JOURNAL(): TerminalNode { return this.getToken(DParser.SOLVED_JOURNAL, 0); }
	public dlgLineRule(): DlgLineRuleContext {
		return this.getRuleContext(0, DlgLineRuleContext);
	}
	constructor(ctx: TransitionFeatureRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterSolvedJournalTransitionFeature) {
			listener.enterSolvedJournalTransitionFeature(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitSolvedJournalTransitionFeature) {
			listener.exitSolvedJournalTransitionFeature(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitSolvedJournalTransitionFeature) {
			return visitor.visitSolvedJournalTransitionFeature(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class UnsolvedJournalTransitionFeatureContext extends TransitionFeatureRuleContext {
	public _entry!: DlgLineRuleContext;
	public UNSOLVED_JOURNAL(): TerminalNode { return this.getToken(DParser.UNSOLVED_JOURNAL, 0); }
	public dlgLineRule(): DlgLineRuleContext {
		return this.getRuleContext(0, DlgLineRuleContext);
	}
	constructor(ctx: TransitionFeatureRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterUnsolvedJournalTransitionFeature) {
			listener.enterUnsolvedJournalTransitionFeature(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitUnsolvedJournalTransitionFeature) {
			listener.exitUnsolvedJournalTransitionFeature(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitUnsolvedJournalTransitionFeature) {
			return visitor.visitUnsolvedJournalTransitionFeature(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class FlagsTransitionFeatureContext extends TransitionFeatureRuleContext {
	public _flags!: StringRuleContext;
	public FLAGS(): TerminalNode { return this.getToken(DParser.FLAGS, 0); }
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	constructor(ctx: TransitionFeatureRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterFlagsTransitionFeature) {
			listener.enterFlagsTransitionFeature(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitFlagsTransitionFeature) {
			listener.exitFlagsTransitionFeature(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitFlagsTransitionFeature) {
			return visitor.visitFlagsTransitionFeature(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ChainDlgRuleContext extends ParserRuleContext {
	public _trigger!: StringRuleContext;
	public _chainElementRule!: ChainElementRuleContext;
	public _initialSpeakerLines: ChainElementRuleContext[] = [];
	public _chainBlockRule!: ChainBlockRuleContext;
	public _blocks: ChainBlockRuleContext[] = [];
	public chainElementRule(): ChainElementRuleContext[];
	public chainElementRule(i: number): ChainElementRuleContext;
	public chainElementRule(i?: number): ChainElementRuleContext | ChainElementRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ChainElementRuleContext);
		} else {
			return this.getRuleContext(i, ChainElementRuleContext);
		}
	}
	public IF(): TerminalNode | undefined { return this.tryGetToken(DParser.IF, 0); }
	public THEN(): TerminalNode | undefined { return this.tryGetToken(DParser.THEN, 0); }
	public EQ(): TerminalNode[];
	public EQ(i: number): TerminalNode;
	public EQ(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.EQ);
		} else {
			return this.getToken(DParser.EQ, i);
		}
	}
	public stringRule(): StringRuleContext | undefined {
		return this.tryGetRuleContext(0, StringRuleContext);
	}
	public chainBlockRule(): ChainBlockRuleContext[];
	public chainBlockRule(i: number): ChainBlockRuleContext;
	public chainBlockRule(i?: number): ChainBlockRuleContext | ChainBlockRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ChainBlockRuleContext);
		} else {
			return this.getRuleContext(i, ChainBlockRuleContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_chainDlgRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterChainDlgRule) {
			listener.enterChainDlgRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitChainDlgRule) {
			listener.exitChainDlgRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitChainDlgRule) {
			return visitor.visitChainDlgRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ChainBlockRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_chainBlockRule; }
	public copyFrom(ctx: ChainBlockRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class MonologChainBlockContext extends ChainBlockRuleContext {
	public _ifExists!: Token;
	public _dlg!: FileRuleContext;
	public _chainElementRule!: ChainElementRuleContext;
	public _elements: ChainElementRuleContext[] = [];
	public EQEQ(): TerminalNode { return this.getToken(DParser.EQEQ, 0); }
	public fileRule(): FileRuleContext {
		return this.getRuleContext(0, FileRuleContext);
	}
	public chainElementRule(): ChainElementRuleContext[];
	public chainElementRule(i: number): ChainElementRuleContext;
	public chainElementRule(i?: number): ChainElementRuleContext | ChainElementRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ChainElementRuleContext);
		} else {
			return this.getRuleContext(i, ChainElementRuleContext);
		}
	}
	public EQ(): TerminalNode[];
	public EQ(i: number): TerminalNode;
	public EQ(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.EQ);
		} else {
			return this.getToken(DParser.EQ, i);
		}
	}
	public IF_FILE_EXISTS(): TerminalNode | undefined { return this.tryGetToken(DParser.IF_FILE_EXISTS, 0); }
	constructor(ctx: ChainBlockRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterMonologChainBlock) {
			listener.enterMonologChainBlock(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitMonologChainBlock) {
			listener.exitMonologChainBlock(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitMonologChainBlock) {
			return visitor.visitMonologChainBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class BranchChainBlockContext extends ChainBlockRuleContext {
	public _trigger!: StringRuleContext;
	public _chainBlockRule!: ChainBlockRuleContext;
	public _blocks: ChainBlockRuleContext[] = [];
	public BRANCH(): TerminalNode { return this.getToken(DParser.BRANCH, 0); }
	public BEGIN(): TerminalNode { return this.getToken(DParser.BEGIN, 0); }
	public END(): TerminalNode { return this.getToken(DParser.END, 0); }
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public chainBlockRule(): ChainBlockRuleContext[];
	public chainBlockRule(i: number): ChainBlockRuleContext;
	public chainBlockRule(i?: number): ChainBlockRuleContext | ChainBlockRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ChainBlockRuleContext);
		} else {
			return this.getRuleContext(i, ChainBlockRuleContext);
		}
	}
	constructor(ctx: ChainBlockRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterBranchChainBlock) {
			listener.enterBranchChainBlock(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitBranchChainBlock) {
			listener.exitBranchChainBlock(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitBranchChainBlock) {
			return visitor.visitBranchChainBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ChainElementRuleContext extends ParserRuleContext {
	public _trigger!: StringRuleContext;
	public _line!: SayTextRuleContext;
	public _action!: StringRuleContext;
	public sayTextRule(): SayTextRuleContext {
		return this.getRuleContext(0, SayTextRuleContext);
	}
	public IF(): TerminalNode | undefined { return this.tryGetToken(DParser.IF, 0); }
	public DO(): TerminalNode | undefined { return this.tryGetToken(DParser.DO, 0); }
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public THEN(): TerminalNode | undefined { return this.tryGetToken(DParser.THEN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_chainElementRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterChainElementRule) {
			listener.enterChainElementRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitChainElementRule) {
			listener.exitChainElementRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitChainElementRule) {
			return visitor.visitChainElementRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FileRuleContext extends ParserRuleContext {
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_fileRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterFileRule) {
			listener.enterFileRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitFileRule) {
			listener.exitFileRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitFileRule) {
			return visitor.visitFileRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SayTextRuleContext extends ParserRuleContext {
	public dlgLineRule(): DlgLineRuleContext {
		return this.getRuleContext(0, DlgLineRuleContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_sayTextRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterSayTextRule) {
			listener.enterSayTextRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitSayTextRule) {
			listener.exitSayTextRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitSayTextRule) {
			return visitor.visitSayTextRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TraLineRuleContext extends ParserRuleContext {
	public _string!: StringRuleContext;
	public _ref!: ReferenceRuleContext;
	public _dlgLine!: DlgLineRuleContext;
	public stringRule(): StringRuleContext | undefined {
		return this.tryGetRuleContext(0, StringRuleContext);
	}
	public referenceRule(): ReferenceRuleContext | undefined {
		return this.tryGetRuleContext(0, ReferenceRuleContext);
	}
	public dlgLineRule(): DlgLineRuleContext | undefined {
		return this.tryGetRuleContext(0, DlgLineRuleContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_traLineRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterTraLineRule) {
			listener.enterTraLineRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitTraLineRule) {
			listener.exitTraLineRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitTraLineRule) {
			return visitor.visitTraLineRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DlgLineRuleContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_dlgLineRule; }
	public copyFrom(ctx: DlgLineRuleContext): void {
		super.copyFrom(ctx);
	}
}
export class GenderedTextContext extends DlgLineRuleContext {
	public _maleLine!: StringRuleContext;
	public _maleSound!: SoundRuleContext;
	public _femaleLine!: StringRuleContext;
	public _femaleSound!: SoundRuleContext;
	public stringRule(): StringRuleContext[];
	public stringRule(i: number): StringRuleContext;
	public stringRule(i?: number): StringRuleContext | StringRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringRuleContext);
		} else {
			return this.getRuleContext(i, StringRuleContext);
		}
	}
	public soundRule(): SoundRuleContext[];
	public soundRule(i: number): SoundRuleContext;
	public soundRule(i?: number): SoundRuleContext | SoundRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(SoundRuleContext);
		} else {
			return this.getRuleContext(i, SoundRuleContext);
		}
	}
	constructor(ctx: DlgLineRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterGenderedText) {
			listener.enterGenderedText(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitGenderedText) {
			listener.exitGenderedText(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitGenderedText) {
			return visitor.visitGenderedText(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class GenderNeutralTextContext extends DlgLineRuleContext {
	public _line!: StringRuleContext;
	public _sound!: SoundRuleContext;
	public stringRule(): StringRuleContext {
		return this.getRuleContext(0, StringRuleContext);
	}
	public soundRule(): SoundRuleContext | undefined {
		return this.tryGetRuleContext(0, SoundRuleContext);
	}
	constructor(ctx: DlgLineRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterGenderNeutralText) {
			listener.enterGenderNeutralText(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitGenderNeutralText) {
			listener.exitGenderNeutralText(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitGenderNeutralText) {
			return visitor.visitGenderNeutralText(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ReferencedTextContext extends DlgLineRuleContext {
	public referenceRule(): ReferenceRuleContext {
		return this.getRuleContext(0, ReferenceRuleContext);
	}
	constructor(ctx: DlgLineRuleContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReferencedText) {
			listener.enterReferencedText(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReferencedText) {
			listener.exitReferencedText(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReferencedText) {
			return visitor.visitReferencedText(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StringRuleContext extends ParserRuleContext {
	public _stringLiteralRule!: StringLiteralRuleContext;
	public _parts: StringLiteralRuleContext[] = [];
	public stringLiteralRule(): StringLiteralRuleContext[];
	public stringLiteralRule(i: number): StringLiteralRuleContext;
	public stringLiteralRule(i?: number): StringLiteralRuleContext | StringLiteralRuleContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StringLiteralRuleContext);
		} else {
			return this.getRuleContext(i, StringLiteralRuleContext);
		}
	}
	public CONCAT(): TerminalNode[];
	public CONCAT(i: number): TerminalNode;
	public CONCAT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(DParser.CONCAT);
		} else {
			return this.getToken(DParser.CONCAT, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_stringRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterStringRule) {
			listener.enterStringRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitStringRule) {
			listener.exitStringRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitStringRule) {
			return visitor.visitStringRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StringLiteralRuleContext extends ParserRuleContext {
	public identifierRule(): IdentifierRuleContext | undefined {
		return this.tryGetRuleContext(0, IdentifierRuleContext);
	}
	public PERCENT_STRING(): TerminalNode | undefined { return this.tryGetToken(DParser.PERCENT_STRING, 0); }
	public TILDE_STRING(): TerminalNode | undefined { return this.tryGetToken(DParser.TILDE_STRING, 0); }
	public LONG_TILDE_STRING(): TerminalNode | undefined { return this.tryGetToken(DParser.LONG_TILDE_STRING, 0); }
	public QUOTE_STRING(): TerminalNode | undefined { return this.tryGetToken(DParser.QUOTE_STRING, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_stringLiteralRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterStringLiteralRule) {
			listener.enterStringLiteralRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitStringLiteralRule) {
			listener.exitStringLiteralRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitStringLiteralRule) {
			return visitor.visitStringLiteralRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IdentifierRuleContext extends ParserRuleContext {
	public IDENTIFIER(): TerminalNode { return this.getToken(DParser.IDENTIFIER, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_identifierRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterIdentifierRule) {
			listener.enterIdentifierRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitIdentifierRule) {
			listener.exitIdentifierRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitIdentifierRule) {
			return visitor.visitIdentifierRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReferenceRuleContext extends ParserRuleContext {
	public SHARP_NUMBER(): TerminalNode | undefined { return this.tryGetToken(DParser.SHARP_NUMBER, 0); }
	public FORCED_STRING_REFERENCE(): TerminalNode | undefined { return this.tryGetToken(DParser.FORCED_STRING_REFERENCE, 0); }
	public TRANSLATION_REFERENCE(): TerminalNode | undefined { return this.tryGetToken(DParser.TRANSLATION_REFERENCE, 0); }
	public PAREN_OPEN(): TerminalNode | undefined { return this.tryGetToken(DParser.PAREN_OPEN, 0); }
	public AT(): TerminalNode | undefined { return this.tryGetToken(DParser.AT, 0); }
	public stringRule(): StringRuleContext | undefined {
		return this.tryGetRuleContext(0, StringRuleContext);
	}
	public PAREN_CLOSE(): TerminalNode | undefined { return this.tryGetToken(DParser.PAREN_CLOSE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_referenceRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterReferenceRule) {
			listener.enterReferenceRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitReferenceRule) {
			listener.exitReferenceRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitReferenceRule) {
			return visitor.visitReferenceRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SharpNumberRuleContext extends ParserRuleContext {
	public SHARP_NUMBER(): TerminalNode { return this.getToken(DParser.SHARP_NUMBER, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_sharpNumberRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterSharpNumberRule) {
			listener.enterSharpNumberRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitSharpNumberRule) {
			listener.exitSharpNumberRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitSharpNumberRule) {
			return visitor.visitSharpNumberRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SoundRuleContext extends ParserRuleContext {
	public SOUND_STRING(): TerminalNode { return this.getToken(DParser.SOUND_STRING, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return DParser.RULE_soundRule; }
	// @Override
	public enterRule(listener: DParserListener): void {
		if (listener.enterSoundRule) {
			listener.enterSoundRule(this);
		}
	}
	// @Override
	public exitRule(listener: DParserListener): void {
		if (listener.exitSoundRule) {
			listener.exitSoundRule(this);
		}
	}
	// @Override
	public accept<Result>(visitor: DParserVisitor<Result>): Result {
		if (visitor.visitSoundRule) {
			return visitor.visitSoundRule(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


