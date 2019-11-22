// File: textmate-grammar-definition.ts                                            //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Fri Nov 8 2019                                                    //
// Last Modified: Fri Nov 22 2019                                                  //
// Modified By: Lieene Guo                                                         //
import { Grammar } from "./grammar";
import TokenName = Grammar.TokenName;

export interface TmGrammar
{
    /** this should be a unique name for the grammar,following the convention of being a dot-separated name where each new (left-most) part specializes the name.
     *  Normally it would be a two-part name where the first is either text or source and the second is the name of the language or document type.
     *  But if you are specializing an existing type, you probably want to derive the name from the type you are specializing.
     *  The advantage of deriving it from (in this case) text.html is that everything which works in the text.html scope
     *  will also work in the text.html.«something» scope (but with a lower precedence than something specifically targeting text.html.«something»).*/
    readonly scopeName: TmGrammar.TmName;

    /** comment for this grammar */
    readonly comment?: string;

    /** this is an array of file type extensions that the grammar should (by default) be used with.*/
    readonly fileTypes?: ReadonlyArray<string>;

    /** these are regular expressions that lines (in the document) are matched against.
     *  If a line matches one of the patterns (but not both), it becomes a folding marker */
    readonly foldingStartMarker?: string;

    /** these are regular expressions that lines (in the document) are matched against.
     *  If a line matches one of the patterns (but not both), it becomes a folding marker */
    readonly foldingStopMarker?: string;

    /** a regular expression which is matched against the first line of the document (when it is first loaded).
     *  If it matches, the grammar is used for the document (unless there is a user override). */
    readonly firstLineMatch?: string;


    /**this is an array with the actual rules used to parse the document. */
    readonly patterns: ReadonlyArray<TmGrammar.TmRule>;

    /** a dictionary (i.e. key/value pairs) of rules which can be included from other places in the grammar.
     *  The key is the name of the rule and the value is the actual rule. */
    readonly repository?: { readonly [key: string]: TmGrammar.TmRule };

    /** A display name of the language that this grammar describes */
    readonly name?: string;

    // /** A uuid of the language that this grammar describes */
    // readonly uuid?: string;
}

export namespace TmGrammar
{
    export function LoadRaw(src: string): TmGrammar | undefined
    {
        try
        {
            //const src = fs.readFileSync(path);
            let gd = JSON.parse(src.toString());
            if (gd.scopeName) { return gd; }
            else { return; }
        }
        catch (e) { return; }

    }

    export function BuildTokenLiterialType(tm: TmGrammar, typeName?: string): string
    {
        let out = `type ${typeName === undefined ? "TokenNames" : typeName} = `;
        for (const name of editTokenNameSet(tm)) { out += `'${name}' | `; }
        return out.slice(0, out.lastIndexOf(" | ")) + ";";
    }

    export function editTokenNameSet(tm: TmGrammar): Set<string>
    {
        let names: Set<string> = new Set<string>();
        let [p, repo] = [tm.patterns, tm.repository];
        findNameInPatterns(p, names);
        if (repo) { for (const key in repo) { findNameInRule(repo[key], names); } }
        return names;
    }

    function findNameInPatterns(patterns: ReadonlyArray<TmRule>, names: Set<string>)
    {
        if (!patterns) { return; }
        for (let i = 0, len = patterns.length; i < len; i++)
        { findNameInRule(patterns[i], names); }
    }

    function findNameInRule(rule: TmRule, names: Set<string>)
    {
        if (!rule) { return; }
        let [n, cn, p, ...ms] =
            [
                (rule as any).name,
                (rule as any).contentName,
                (rule as any).patterns,
                (rule as any).begin,
                (rule as any).end, (rule as any).match
            ];

        if (n) { names.add(n); }
        if (cn) { names.add(cn); }
        findNameInPatterns(p, names);
        for (let i = 0, len = ms.length; i < len; i++)
        { findNameInCaptures(ms[i], names); }
    }

    function findNameInCaptures(cap: TmCapturesByID, names: Set<string>)
    {
        if (!cap) { return; }
        for (const id in cap)
        {
            let cr = cap[id as TmCaptureID];
            if (cr)
            {
                let [n, p] = [(cr as any).name, (cr as any).patterns];
                if (n !== undefined) { names.add(n); }
                findNameInPatterns(p, names);
            }
        }
    }




    export type TmRule = TmMatchRule | TmBeginEndRule | TmRefRule;

    interface TmRuleCommon
    {
        /** comment for this specific rule */
        readonly comment?: string;

        // /** flag indicates if the rule is enabled or disabled*/
        // readonly disabled?: number;

        /** the scoped name which gets assigned to the portion matched.
         *  for unnamed match parent name will be used for the segment of code
         *  the name follows the convention of being a dot-separated name where each new (left-most) part specializes the name
         *  and should generally be derived from one of the standard names. */
        readonly name?: TmName;

        /** array of the actual rules used to parse the document. */
        readonly patterns?: ReadonlyArray<TmRule>;

        // readonly while?: string;
    }

    interface TmBeginEndRule extends TmRuleCommon
    {
        /** a regular expression pattern that starts a block
         *  togather with end, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        readonly begin: string;

        /** a regular expression pattern that ends a block
         *  togather with begin, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        readonly end: string;

        /** key allow you to assign attributes to the captures of the begin patterns. */
        readonly beginCaptures?: TmCapturesByID;

        /** key allow you to assign attributes to the captures of the end patterns. */
        readonly endCaptures?: TmCapturesByID;

        /** a short-hand allow you to assign attributes to the captures of the begin and end patterns with same values. */
        readonly captures?: TmCapturesByID;

        /** this key is similar to the name key but only assigns the name to the text between what is matched by the begin/end patterns. */
        readonly contentName?: TmName;

        /** specific if end pattern should be applied before content match rules*/
        readonly applyEndPatternLast?: boolean;
    }

    interface TmMatchRule extends TmRuleCommon
    {
        /** a regular expression which is used to identify the portion of text to which the name should be assigned. */
        readonly match: string;

        /** keys allow you to assign attributes to the captures of the match */
        readonly captures?: TmCapturesByID;
    }

    interface TmRefRule
    {
        /** this allows you to reference a different language, recursively reference the grammar itself or a rule declared in this file’s repository. 
         *  1.To reference another language, use the scope name of that language.
         *  2.To reference the grammar itself, use $self.
         *  3.To reference a rule from the current grammars repository, prefix the name with a pound sign (#).
        */
        readonly include: string;
    }

    export type TmCapturesByID = { readonly [index in TmCaptureID]?: TmCaptureRule; };

    export type TmCaptureRule = TmCaptureName | TmCaptureSub;

    interface TmCaptureName
    {
        /** the scoped name which gets assigned to the portion matched. 
         *  for unnamed match parent name will be used for the segment of code
         *  the name follows the convention of being a dot-separated name where each new (left-most) part specializes the name 
         *  and should generally be derived from one of the standard names. */
        readonly name: TmName;
    }
    interface TmCaptureSub
    {
        /** array of the actual rules used to parse the document. */
        readonly patterns: TmRule[];
    }

    //#region edit------------------------------------------------------------------------
    export interface TmGrammarEdit extends TmGrammar
    {
        setScopeName(name: TokenName): void;
        setGrammarName(name: string): void;

        setFileTypes(...types: string[]): void;
        addFileType(...types: string[]): void;
        removeFileType(...keys: (string | number)[]): void;

        setFirstLineMatch(match: string): void;

        addRootRule(...patterns: TmRule[]): void;
        removeRootRule(...i: number[]): void;
        setRootRule(i: number, run: TmRule): void;
        editRootRule(i: number): TmRuleEdit | undefined;

        addRepositoryRule(key: string, rule: TmRule): void;
        addRepositoryRule(...patterns: [string, TmRule][]): void;
        removeRepositoryRule(...keys: (string | number)[]): void;
        setRepositoryRule(key: (string | number), rule: TmRule): void;
        editRepositoryRule(key: string | number): TmRuleEdit | undefined;
    }

    type TmRuleEdit = TmMatchRuleEdit | TmBeginEndRuleEdit | TmRefRuleEdit;

    interface TmPatternBaseEdit extends TmRuleCommon
    {
        setTokenName(name: TokenName | undefined): void;
        setCommnet(cmt: string | undefined): void;
        enable(): void;
        disable(): void;

        addRule(...patterns: TmRule[]): void;
        removeRule(...i: number[]): void;
        setRule(i: number, rule: TmRule): void;
        editRule(i: number): TmRuleEdit | undefined;
    }

    export interface TmMatchRuleEdit extends TmPatternBaseEdit, TmMatchRule
    {
        setMatch(match: string): void;
        removeCapture(...i: number[]): void;
        addCapture(...cap: TmCaptureRule[]): void;
        setCapture(i: number, cap: TmCaptureRule): void;
        editCapture(i: number): TmCapEdit;
    }

    export interface TmBeginEndRuleEdit extends TmPatternBaseEdit, TmBeginEndRule
    {
        setContentTokenName(name: TokenName | undefined): void;

        setBeginMatch(match: string): void;

        removeBeginCapture(...i: number[]): void;
        addBeginCapture(...cap: TmCaptureRule[]): void;
        setBeginCapture(i: number, cap: TmCaptureRule): void;
        editBeginCapture(i: number): TmCapEdit;

        setEndMatch(match: string): void;

        removeEndCapture(...i: number[]): void;
        addEndCapture(...cap: TmCaptureRule[]): void;
        setEndCapture(i: number, cap: TmCaptureRule): void;
        editEndCapture(i: number): TmCapEdit;

        removeCapture(...i: number[]): void;
        addCapture(...cap: TmCaptureRule[]): void;
        setCapture(i: number, cap: TmCaptureRule): void;
        editCapture(i: number): TmCapEdit;

        setApplyEndPatternLast(index: number | undefined): void;
    }

    export interface TmRefRuleEdit extends TmRefRule
    {
        setReference(key: string): void;
    }

    type TmCapEdit = TmCaptureEdit | TmCapturePatternsEdit;

    export interface TmCaptureEdit extends TmCaptureName
    {
        NameName(name: TokenName): void;
    }

    export interface TmCapturePatternsEdit extends TmCaptureSub
    {
        addRule(...patterns: TmRule[]): void;
        removeRule(...i: number[]): void;
        setRule(i: number, rule: TmRule): void;
        editRule(i: number): TmRuleEdit | undefined;
    }
    //#endregion edit------------------------------------------------------------------------

    export type TmName = TmCommonNames | string;

    //#region literials------------------------------------------------------------------------
    export type TmCaptureID =
        "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" |
        "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" |
        "20" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" |
        "30" | "31" | "32" | "33" | "34" | "35" | "36" | "37" | "38" | "39" |
        "40" | "41" | "42" | "43" | "44" | "45" | "46" | "47" | "48" | "49" |
        "50" | "51" | "52" | "53" | "54" | "55" | "56" | "57" | "58" | "59" |
        "60" | "61" | "62" | "63" | "64" | "65" | "66" | "67" | "68" | "69" |
        "70" | "71" | "72" | "73" | "74" | "75" | "76" | "77" | "78" | "79" |
        "80" | "81" | "82" | "83" | "84" | "85" | "86" | "87" | "88" | "89" |
        "90" | "91" | "92" | "93" | "94" | "95" | "96" | "97" | "98" | "99" |
        "100" | "101" | "102" | "103" | "104" | "105" | "106" | "107" | "108" | "109" |
        "110" | "111" | "112" | "113" | "114" | "115" | "116" | "117" | "118" | "119" |
        "120" | "121" | "122" | "123" | "124" | "125" | "126" | "127" | "128" | "129" |
        "130" | "131" | "132" | "133" | "134" | "135" | "136" | "137" | "138" | "139" |
        "140" | "141" | "142" | "143" | "144" | "145" | "146" | "147" | "148" | "149" |
        "150" | "151" | "152" | "153" | "154" | "155" | "156" | "157" | "158" | "159" |
        "160" | "161" | "162" | "163" | "164" | "165" | "166" | "167" | "168" | "169" |
        "170" | "171" | "172" | "173" | "174" | "175" | "176" | "177" | "178" | "179" |
        "180" | "181" | "182" | "183" | "184" | "185" | "186" | "187" | "188" | "189" |
        "190" | "191" | "192" | "193" | "194" | "195" | "196" | "197" | "198" | "199" |
        "200" | "201" | "202" | "203" | "204" | "205" | "206" | "207" | "208" | "209" |
        "210" | "211" | "212" | "213" | "214" | "215" | "216" | "217" | "218" | "219" |
        "220" | "221" | "222" | "223" | "224" | "225" | "226" | "227" | "228" | "229" |
        "230" | "231" | "232" | "233" | "234" | "235" | "236" | "237" | "238" | "239" |
        "240" | "241" | "242" | "243" | "244" | "245" | "246" | "247" | "248" | "249";

    export type TmCommonNames =
        "comment" |
        "comment.block" |
        "comment.block.documentation" |
        "comment.line" |
        "comment.line.double-dash" |
        "comment.line.double-slash" |
        "comment.line.number-sign" |
        "comment.line.percentage" |
        "constant" |
        "constant.character" |
        "constant.character.escape" |
        "constant.language" |
        "constant.numeric" |
        "constant.other" |
        "constant.regexp" |
        "constant.rgb-value" |
        "entity" |
        "entity.name" |
        "entity.name.class" |
        "entity.name.function" |
        "entity.name.method" |
        "entity.name.section" |
        "entity.name.selector" |
        "entity.name.tag" |
        "entity.name.type" |
        "entity.other" |
        "entity.other.attribute-name" |
        "entity.other.inherited-class" |
        "invalid" |
        "invalid.deprecated" |
        "invalid.illegal" |
        "keyword" |
        "keyword.control" |
        "keyword.control.less" |
        "keyword.operator" |
        "keyword.operator.new" |
        "keyword.other" |
        "markup" |
        "markup.bold" |
        "markup.changed" |
        "markup.deleted" |
        "markup.heading" |
        "markup.inline.raw" |
        "markup.inserted" |
        "markup.italic" |
        "markup.list" |
        "markup.list.numbered" |
        "markup.list.unnumbered" |
        "markup.other" |
        "markup.punctuation.list.beginning" |
        "markup.punctuation.quote.beginning" |
        "markup.quote" |
        "markup.raw" |
        "markup.underline" |
        "markup.underline.link" |
        "meta" |
        "meta.cast" |
        "meta.parameter.type.variable" |
        "meta.preprocessor" |
        "meta.preprocessor.numeric" |
        "meta.preprocessor.string" |
        "meta.return-type" |
        "meta.selector" |
        "meta.tag" |
        "meta.type.annotation" |
        "meta.type.name" |
        "storage" |
        "storage.modifier" |
        "storage.type" |
        "string" |
        "string.html" |
        "string.interpolated" |
        "string.jade" |
        "string.other" |
        "string.quoted" |
        "string.quoted.double" |
        "string.quoted.other" |
        "string.quoted.single" |
        "string.quoted.triple" |
        "string.regexp" |
        "string.unquoted" |
        "string.xml" |
        "string.yaml" |
        "support" |
        "support.class" |
        "support.constant" |
        "support.function" |
        "support.other" |
        "support.type" |
        "support.variable" |
        "variable" |
        "variable.language" |
        "variable.name" |
        "variable.other" |
        "variable.parameter";
    //#endregion literials------------------------------------------------------------------------
}

// import * as jtm from "../__tests__/syntaxes/JSON.tmLanguage.json";
// let a: TmGrammar = jtm;
// import * as cstm from "../__tests__/syntaxes/csharp.tmLanguage.json";
// let b: GrammarDef = cstm;
// let x = b.patterns[0];
// let r = a.repository!.array;

// import fs from "fs";
// let b = fs.readFileSync('d:/GitProject/SRTK/CodeExt/TestsSpace/JSONC.tmLanguage.json');
// let a = JSON.parse(b.toString());
// console.log(a.repository);

