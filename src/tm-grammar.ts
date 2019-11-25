// File: textmate-grammar-definition.ts                                            //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Fri Nov 8 2019                                                    //
// Last Modified: Mon Nov 25 2019                                                  //
// Modified By: Lieene Guo                                                         //
import * as L from "@lieene/ts-utility";
import { OnigScanner } from "oniguruma-ext";
import { Text } from "text-editing";
import { Name } from "poly-tree";
export namespace Textmate
{
    //#region helper types

    //https://regex101.com/r/tQeI1f/1
    export const scopeNamePattern = /^(?:[\w0-9][\-\w0-9]*|\$(?:\d+|[\w]+\([\w]+\)))(?:\.(?:[\w0-9][\-\w0-9]*|\$(?:\d+|[\w]+\([\w]+\))))*$/;
    //https://regex101.com/r/2f16K8/1
    export const scopeNameCmdPattern = /^\$(?:(\d+)|([\w]+)\(([\w]+)\))$/;
    export class ScopeName
    {
        constructor(name: string);
        constructor(gender: string, language: string);
        constructor(gender: string, ...rest: string[]);
        constructor(...parts: string[]);
        constructor(...parts: string[])
        {
            if (parts.length === 1)
            {
                let nameStr = parts[0];
                this.stackNames = nameStr.split(/\s+/);
                var pts = new Array<Array<string>>();
                this.stackNames.forEach(n =>
                {
                    if (!scopeNamePattern.test(n)) { throw new Error(`invalid scope name: ${n}`); }
                    pts.push(n.split('.'));
                });
                this.stackParts = pts;
            }
            else
            {
                this.stackNames = [parts.join('.')];
                if (!scopeNamePattern.test(this.stackNames[0])) { throw new Error(`invalid scope name: ${this.stackNames[0]}`); }
                this.stackParts = [parts];
            }
        }
        readonly stackNames: ReadonlyArray<string>;
        readonly stackParts: ReadonlyArray<ReadonlyArray<string>>;

        get name(): string { return this.stackNames.last!; }
        get parts(): ReadonlyArray<string> { return this.stackParts.last!; }

        /** most specializes part of the scope*/
        get language(): string { return this.stackParts.last!.last!; }
        /** least specializes part of the scope*/
        get scopeType(): string { return this.stackParts.last!.first!; }

        static parseCommand(part: string): undefined |
            number | { cmd: string, param: string }
        {
            let match = part.match(scopeNameCmdPattern);
            if (match)
            {
                let num = match[1];
                if (num && num.length > 0) { return Number.parseInt(match[1]); }
                let [cmd, param] = [match[2], match[3]];
                if (cmd) { return { cmd, param }; }
            }
        }

        toString(): string { return this.stackParts.map(p => p.join('.')).join(' '); }
    }

    export class RefName
    {
        constructor(rule: string, mode: "$local");
        constructor(lang: ScopeName, rule: string, mode: "$external");
        constructor(lang: ScopeName, mode: "$external");
        constructor(special: "$self" | "$base");
        constructor(raw: string);
        constructor(arg0: ScopeName | string | "$self" | "$base", arg1?: string | "$external" | "$local", arg2?: "$external")
        {
            if (L.IsString(arg0))
            {
                if (arg0 === "$self" || arg0 === "$base") { this.special = arg0; }
                else if (arg1 === "$local") { this.rule = arg0; }
                else
                {
                    if (arg0.startsWith("#"))
                    { this.rule = arg0.substring(1); }
                    else 
                    {
                        let parts = arg0.split("#");
                        if (parts[0].length === arg0.length)
                        { this.lang = new ScopeName(arg0); }
                        else if (parts.length === 2)
                        { [this.lang, this.rule] = [new ScopeName(parts[0]), parts[1]]; }
                        else { throw new Error(`invalid lang#rule form ${arg0}`); }
                    }
                }
            }
            else if (arg1 === "$external") { this.lang = arg0; }
            else if (arg2 === "$external") { [this.lang, this.rule] = [arg0, arg1 as string]; }
        }
        get isExternal(): boolean { return this.lang !== undefined; }
        get isLocal(): boolean { return this.lang === undefined; }
        get is$self(): boolean { return this.special === "$self"; }
        get is$base(): boolean { return this.special === "$base"; }
        readonly lang?: ScopeName;
        readonly rule?: string;
        readonly special?: "$self" | "$base";
        toString()
        {
            return this.special ? this.special :
                this.lang ?
                    (this.rule ?
                        `${this.lang.toString()}#${this.rule!.toString()}` :
                        this.lang.toString()) :
                    `#${this.rule!.toString()}`;
        }
    }

    export function TestCaptureID(id: string): void
    {
        let nid = Number.parseInt(id) >>> 0;
        if (nid < 0) { throw new Error(`invalid capture id[${id}]`); }
    }

    export interface RuleLocater
    {
        key?: string;
        index: number;
        parent?: Grammar | Rule;
    }

    export type Repository = { [key: string]: Rule };

    export type Captures = { [index in CaptureID]?: Rule | NameRule };

    //#endregion helper types


    export interface Grammar extends RuleLocater
    {
        /** this should be a unique name for the grammar,following the convention of being a dot-separated name where each new (left-most) part specializes the name.
         *  Normally it would be a two-part name where the first is either text or source and the second is the name of the language or document type.
         *  But if you are specializing an existing type, you probably want to derive the name from the type you are specializing.
         *  The advantage of deriving it from (in this case) text.html is that everything which works in the text.html scope
         *  will also work in the text.html.«something» scope (but with a lower precedence than something specifically targeting text.html.«something»).*/
        scopeName: ScopeName;

        /** comment for this grammar */
        comment?: string;

        /** this is an array of file type extensions that the grammar should (by default) be used with.*/
        fileTypes?: Array<string>;

        /** these are regular expressions that lines (in the document) are matched against.
         *  If a line matches one of the patterns (but not both), it becomes a folding marker */
        foldingStartMarker?: string;

        /** these are regular expressions that lines (in the document) are matched against.
         *  If a line matches one of the patterns (but not both), it becomes a folding marker */
        foldingStopMarker?: string;

        /** a regular expression which is matched against the first line of the document (when it is first loaded).
         *  If it matches, the grammar is used for the document (unless there is a user override). */
        firstLineMatch?: string;


        /**this is an array with the actual rules used to parse the document. */
        patterns: Array<Rule>;

        /** a dictionary (i.e. key/value pairs) of rules which can be included from other places in the grammar.
         *  The key is the name of the rule and the value is the actual rule. */
        repository?: Repository;

        /** alias for scopeName*/
        name: ScopeName;

        /** A display name of the language that this grammar describes */
        displayName?: string;

        updateRules: () => Array<AnyRule>;
        ruleMap: () => Map<string, Rule>;
    }

    //#region Rules
    export type Rule = RuleGroup | Match | BeginEnd | BeginWhile | Include;
    export type AnyRule = Rule | NameRule;

    export interface RuleCommon extends RuleLocater
    {
        /** comment for this rule */
        comment?: string;

        /** the scoped name which gets assigned to the portion matched.
         *  for unnamed match parent name will be used for the segment of code
         *  the name follows the convention of being a dot-separated name where each new (left-most) part specializes the name
         *  and should generally be derived from one of the standard names. */
        name?: ScopeName;
        /** a dictionary (i.e. key/value pairs) of rules which can be included from other places in the grammar.
         *  The key is the name of the rule and the value is the actual rule. */
        repository?: Repository;

        /** This is a convenient way to experiment or develop, leaving a rule in place while effectively commenting it out */
        disabled?: 1;


    }

    export interface NameRule extends RuleCommon
    {
        /** the scoped name which gets assigned to the portion matched.
         *  for unnamed match parent name will be used for the segment of code
         *  the name follows the convention of being a dot-separated name where each new (left-most) part specializes the name
         *  and should generally be derived from one of the standard names. */
        name: ScopeName;
    }

    export interface RuleGroup extends RuleCommon
    {
        /** an array of Rules in this group. */
        patterns: Array<Rule>;
    }

    export function IsRuleGroup(rule: RuleGroup): rule is RuleGroup
    {
        return (<any>rule).patterns && !(<any>rule).match && !(<any>rule).begin && !(<any>rule).include;
    }

    export interface Match extends RuleCommon
    {
        /** a regular expression which is used to identify the portion of text to which the name should be assigned. */
        match: OnigScanner;

        /** keys allow you to assign attributes to the captures of the match */
        captures?: Captures;
    }

    export function IsMatchRule(rule: Match): rule is Match
    {
        return (<any>rule).match && !(<any>rule).begin && !(<any>rule).include;
    }

    export interface BeginEnd extends RuleCommon
    {
        /** a regular expression pattern that starts a block
         *  togather with end, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        begin: OnigScanner;

        /** a regular expression pattern that ends a block
         *  togather with begin, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        end: OnigScanner;

        /** key allow you to assign attributes to the captures of the begin patterns. */
        beginCaptures?: Captures;

        /** key allow you to assign attributes to the captures of the end patterns. */
        endCaptures?: Captures;

        /** a short-hand allow you to assign attributes to the captures of the begin and end patterns with same values. */
        captures?: Captures;

        /** this key is similar to the name key but only assigns the name to the text between what is matched by the begin/end patterns. */
        contentName?: ScopeName;

        /** array of the actual rules used to parse the document. */
        patterns?: ReadonlyArray<Rule>;

        applyEndPatternLast?: boolean;

    }

    export function IsBeginEndRule(rule: BeginEnd): rule is BeginEnd
    {
        return !(<any>rule).match && (<any>rule).begin && (<any>rule).end && !(<any>rule).while && !(<any>rule).include;
    }

    export interface BeginWhile extends RuleCommon
    {
        /** a regular expression pattern that starts a block
         *  togather with end, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        begin: OnigScanner;

        /** a regular expression pattern that ends a block
         *  togather with begin, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        while: OnigScanner;

        /** key allow you to assign attributes to the captures of the begin patterns. */
        beginCaptures?: Captures;

        /** a short-hand allow you to assign attributes to the captures of the begin and end patterns with same values. */
        captures?: Captures;

        /** array of the actual rules used to parse the document. */
        patterns?: Array<Rule>;
    }

    export function IsBeginWhileRule(rule: BeginWhile): rule is BeginWhile
    {
        return !(<any>rule).match && (<any>rule).begin && (<any>rule).while && !(<any>rule).end && !(<any>rule).include;
    }

    export interface Include extends RuleCommon
    {
        /** this allows you to reference a different language, recursively reference the grammar itself or a rule declared in this file’s repository. 
         *  1.To reference another language, use the scope name of that language.
         *  2.To reference the grammar itself, use $self.
         *  3.To reference a rule from the current grammars repository, prefix the name with a pound sign (#).
        */
        include: RefName;
    }

    export function IsIncludeRule(rule: Include): rule is Include
    { return (<any>rule).include !== undefined; }

    //#endregion Rules


    //#region JSON
    export function FromJSON(src: string | Text): Grammar | undefined
    {
        try
        {
            let grammar: Grammar = JSON.parse(src.toString(), function (this: any, key: any, value: any)
            {
                if (this === value)//Root grammar itself as value
                {
                    try { this.scopeName = new ScopeName(this.scopeName); }
                    catch (e) { return "[Invalid Scope name]" + this.scopeName; }
                    this.displayName = this.name;
                    this.name = this.scopeName;
                    return this;
                }
                else
                {
                    if (key === "name" && this.scopeName !== undefined) { return value; }//skip root grammar name
                    else if (key === "name" || key === "contentName")
                    {
                        try { return new ScopeName(value); }
                        catch (e) { return "[Invalid Scope name]" + value.toString(); }
                    }
                    else if (key === "match" || key === "begin" || key === "end" || key === "while")
                    {
                        try { return new OnigScanner(value); }
                        catch (e)
                        {
                            if (key === "end")
                            {
                                try//try end with back refference
                                {
                                    let oni = new OnigScanner(this.begin.toString() + value);
                                    (oni as any).backRefference = value;//so we can fix this later if combining is not valid
                                }
                                catch (e) { }
                            }
                            return "[Invalid oniguruma regex]" + value.toString();
                        }
                    }
                    else if (key === "include")
                    {
                        try { return new RefName(value); }
                        catch (e) { return "[Invalid invlude]" + value.toString(); }
                    }
                    else if (key === "captures" || key === "beginCaptures" || key === "endCaptures")
                    {
                        for (const id in value)
                        {
                            try { TestCaptureID(id); }
                            catch (e) { value[id].name = e.toString(); }
                        }
                    }
                    else { return value; }
                }
            });

            var findRepoRules = function (this: RuleLocater, repoRules?: Map<string, Rule>): Map<string, Rule>
            {
                if (!repoRules)
                {
                    repoRules = new Map<string, Rule>();
                    repoRules.set((this as Grammar).scopeName.toString(), this as RuleGroup);
                }
                let r: AnyRule;
                //if (!this) { return repoRules; }
                let [patterns, repo, ...caps] =
                    [
                        (this as RuleGroup).patterns,
                        (this as RuleGroup).repository,
                        (this as BeginEnd).beginCaptures,
                        (this as BeginEnd).endCaptures,
                        (this as Match).captures
                    ];
                if (patterns)
                {
                    for (let i = 0, len = patterns.length; i < len; i++)
                    {
                        r = patterns[i];
                        if (r) { findRepoRules.call(r, repoRules); }
                    }
                }
                if (repo)
                {
                    for (const key in repo)
                    {
                        r = repo[key];
                        if (r) { repoRules.set(key, r); findRepoRules.call(r, repoRules); }
                    }
                }
                for (let i = 0, len = caps.length; i < len; i++)
                {
                    let cap = caps[i];
                    if (cap)
                    {
                        for (const id in cap)
                        {
                            r = cap[id as CaptureID]!;
                            if (r) { findRepoRules.call(r, repoRules); }
                        }
                    }
                }
                return repoRules;
            };
            grammar.ruleMap = findRepoRules;

            let updateRules = function (this: RuleLocater, allRules?: Array<AnyRule>): Array<AnyRule>
            {
                let index = 0;
                if (!allRules)
                {
                    allRules = [this as Rule];
                    this.index = index++;
                    this.key = (this as Grammar).scopeName.toString();
                    this.parent = undefined;
                }
                if (!this) { return allRules; }
                let [patterns, repo, ...caps] =
                    [
                        (this as RuleGroup).patterns,
                        (this as RuleCommon).repository,
                        (this as BeginEnd).beginCaptures,
                        (this as BeginEnd).endCaptures,
                        (this as Match).captures
                    ];
                if (patterns)
                {
                    for (let i = 0, len = patterns.length; i < len; i++)
                    {
                        let r = patterns[i];
                        if (r)
                        {
                            r.index = index++;
                            r.parent = this as Rule;
                            r.key = undefined;
                            allRules.push(r);
                            updateRules.call(r, allRules);
                        }
                    }
                }
                if (repo)
                {
                    for (const key in repo)
                    {
                        let r = repo[key];
                        if (r)
                        {
                            r.index = index++;
                            r.parent = this as Rule;
                            r.key = key;
                            allRules.push(r);
                            updateRules.call(r, allRules);
                        }
                    }
                }
                for (let i = 0, len = caps.length; i < len; i++)
                {
                    let cap = caps[i];
                    if (cap)
                    {
                        for (const id in cap)
                        {
                            let r = cap[id as CaptureID];
                            if (r)
                            {
                                r.index = index++;
                                r.parent = this as Rule;
                                r.key = undefined;
                                allRules.push(r); updateRules.call(r, allRules);
                            }
                        }
                    }
                }
                return allRules;
            };
            grammar.updateRules = updateRules;
            grammar.updateRules();
            return grammar;
        }
        catch (e)
        {
            throw e;
            return;
        }
    }

    export function ToJSON(grammar: Grammar): string
    {
        return JSON.stringify(grammar, function (this: any, key: any, value: any): any
        {
            if (key === "parent" || key === "key" || key === "index" || key === "allRules" || key === "ruleMap")//skip helper properties
            { return undefined; }
            else if (this === grammar)
            {
                if (key === "scopeName") { return value.toString(); }
                if (key === "displayName") { return undefined; }
                if (key === "name") { return this.displayName; }
            }
            else if (key === "name" || key === "contentName" || key === "match" || key === "begin" || key === "end" || key === "while" || key === "include")
            { return value.toString(); }
            else if (typeof value !== "function") { return value; }
        });
    }

    //#endregion JSON


    //#region ScopeName utility
    export function BuildScopeLiterialType(tm: Grammar, typeName?: string): string
    {
        let out = `type ${typeName === undefined ? "TokenNames" : typeName} = `;
        for (const name of GeScopeNameSet(tm)) { out += `'${name}' | `; }
        return out.slice(0, out.lastIndexOf(" | ")) + ";";
    }

    export function GeScopeNameSet(tm: Grammar): Set<string>
    {
        var names: Set<string> = new Set<string>();
        let findNameInRule = function (rule: AnyRule)
        {
            if (rule)
            {
                let [name, contentName, patterns, repo, ...caps] =
                    [
                        (rule as NameRule).name,
                        (rule as BeginEnd).contentName,
                        (rule as RuleGroup).patterns,
                        (rule as RuleCommon).repository,
                        (rule as BeginEnd).beginCaptures,
                        (rule as BeginEnd).endCaptures,
                        (rule as Match).captures
                    ];
                if (name) { name.stackNames.forEach(n => names.add(n)); }
                if (contentName) { names.add(contentName.toString()); }
                if (repo) { for (const key in repo) { findNameInRule(repo[key]); } }
                if (patterns) { for (let i = 0, len = patterns.length; i < len; i++) { findNameInRule(patterns[i]); } }
                for (let i = 0, len = caps.length; i < len; i++)
                {
                    let cap = caps[i];
                    if (cap) { for (const id in cap) { findNameInRule(cap[id as CaptureID]!); } }
                }
            }
        };

        let [patterns, repo] = [tm.patterns, tm.repository];
        if (patterns) { for (let i = 0, len = patterns.length; i < len; i++) { findNameInRule(patterns[i] as any); } }
        if (repo) { for (const key in repo) { findNameInRule(repo[key] as any); } }
        return names;
    }

    //#endregion ScopeName utility

}

//#region literials------------------------------------------------------------------------
export type CaptureID =
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

