// File: textmate-grammar-definition.ts                                            //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Fri Nov 8 2019                                                    //
// Last Modified: Mon Nov 25 2019                                                  //
// Modified By: Lieene Guo                                                         //
import { Grammar } from "./grammar";
import * as L from "@lieene/ts-utility";
import TokenName = Grammar.TokenName;
import { OnigScanner } from "oniguruma-ext";

export namespace Textmate
{
    const scopeNamePattern = /^[\w0-9]+(?:\.[\w0-9]+)*$/;
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
                if (!scopeNamePattern.test(nameStr)) { throw new Error(`invalid scope name: ${nameStr}`); }
                this.name = nameStr;
                this.parts = nameStr.split('.');
            }
            else
            {
                this.name = parts.join('.');
                if (!scopeNamePattern.test(this.name)) { throw new Error(`invalid scope name: ${this.name}`); }
                this.parts = parts;
            }
        }
        readonly name: string;

        readonly parts: ReadonlyArray<string>;

        /** most specializes part of the scope*/
        get language(): string { return this.parts.last!; }
        /** least specializes part of the scope*/
        get scopeType(): string { return this.parts.first!; }

        toString(): string { return this.parts.join('.'); }
    }

    export class RefName
    {
        constructor(rule: ScopeName);
        constructor(lang: ScopeName, rule: ScopeName, mode: "external");
        constructor(lang: ScopeName, mode: "external");
        constructor(special: "$self" | "$base");
        constructor(raw: string);
        constructor(arg0: ScopeName | string | "$self" | "$base", arg1?: ScopeName | "external", arg2?: "external")
        {
            if (L.IsString(arg0))
            {
                if (arg0 === "$self" || arg0 === "$base") { this.special = arg0; }
                else 
                {
                    if (arg0.startsWith("#"))
                    { this.rule = new ScopeName(arg0.substring(1)); }
                    else 
                    {
                        let parts = arg0.split("#");
                        if (parts[0].length === arg0.length)
                        { this.lang = new ScopeName(arg0); }
                        else if (parts.length === 2)
                        { [this.lang, this.rule] = [new ScopeName(parts[0]), new ScopeName(parts[1]);]; }
                        else { throw new Error(`invalid lang#rule form ${arg0}`); }
                    }
                }
            }
            else if (arg2 === "external") { [this.lang, this.rule] = [arg0, arg1 as ScopeName]; }
            else if (arg1 === "external") { this.lang = arg0; }
            else { this.rule = arg0; }
        }
        get isExternal(): boolean { return this.lang !== undefined; }
        get is$self(): boolean { return this.special === "$self"; }
        get isbase(): boolean { return this.special === "$base"; }
        readonly lang?: ScopeName;
        readonly rule?: ScopeName;
        readonly special?: "$self" | "$base";
        toString()
        { return this.special ? this.special : this.lang ? `${this.lang.toString()}#${this.rule!.toString()}` : `#${this.rule!.toString()}`; }
    }

    export function TestCaptureID(id: string): void
    {
        let nid = Number.parseInt(id) >>> 0;
        if (nid < 0) { throw new Error(`invalid capture id[${id}]`); }
    }

    export interface Grammar<TScopeName, TRegexStr, TRefName>
    {
        /** this should be a unique name for the grammar,following the convention of being a dot-separated name where each new (left-most) part specializes the name.
         *  Normally it would be a two-part name where the first is either text or source and the second is the name of the language or document type.
         *  But if you are specializing an existing type, you probably want to derive the name from the type you are specializing.
         *  The advantage of deriving it from (in this case) text.html is that everything which works in the text.html scope
         *  will also work in the text.html.«something» scope (but with a lower precedence than something specifically targeting text.html.«something»).*/
        scopeName: TScopeName;

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
        patterns: Array<Rule<TScopeName, TRegexStr, TRefName>>;

        /** a dictionary (i.e. key/value pairs) of rules which can be included from other places in the grammar.
         *  The key is the name of the rule and the value is the actual rule. */
        repository?: Repository<TScopeName, TRegexStr, TRefName>;

        /** A display name of the language that this grammar describes */
        name?: TScopeName;

        // /** A uuid of the language that this grammar describes */
        // uuid?: string;
    }

    export type Rule<TScopeName, TRegexStr, TRefName> = RuleGroup<TScopeName, TRegexStr, TRefName> | Match<TScopeName, TRegexStr, TRefName> | BeginEnd<TScopeName, TRegexStr, TRefName> | BeginWhile<TScopeName, TRegexStr, TRefName> | Include<TRefName>;

    export interface RuleCommon<TScopeName, TRegexStr, TRefName>
    {
        /** comment for this rule */
        comment?: string;

        /** the scoped name which gets assigned to the portion matched.
         *  for unnamed match parent name will be used for the segment of code
         *  the name follows the convention of being a dot-separated name where each new (left-most) part specializes the name
         *  and should generally be derived from one of the standard names. */
        name?: TScopeName;
        /** a dictionary (i.e. key/value pairs) of rules which can be included from other places in the grammar.
         *  The key is the name of the rule and the value is the actual rule. */
        repository?: Repository<TScopeName, TRegexStr, TRefName>;

        /** This is a convenient way to experiment or develop, leaving a rule in place while effectively commenting it out */
        disabled?: 1;
    }

    export interface RuleGroup<TScopeName, TRegexStr, TRefName> extends RuleCommon<TScopeName, TRegexStr, TRefName>
    {
        /** an array of Rules in this group. */
        patterns: Array<Rule<TScopeName, TRegexStr, TRefName>>;
    }

    export function IsRuleGroup<TScopeName, TRegexStr, TRefName>(rule: RuleGroup<TScopeName, TRegexStr, TRefName>): rule is RuleGroup<TScopeName, TRegexStr, TRefName>
    {
        return (<any>rule).patterns && !(<any>rule).match && !(<any>rule).begin && !(<any>rule).include;
    }

    export interface Match<TScopeName, TRegexStr, TRefName> extends RuleCommon<TScopeName, TRegexStr, TRefName>
    {
        /** a regular expression which is used to identify the portion of text to which the name should be assigned. */
        match: TRegexStr;

        /** keys allow you to assign attributes to the captures of the match */
        captures?: Captures<TScopeName, TRegexStr, TRefName>;

        //patterns need to be in captures as there are nothing to match here
        //patterns: Array<TmRule>;
    }

    export function IsMatchRule<TScopeName, TRegexStr, TRefName>(rule: Match<TScopeName, TRegexStr, TRefName>): rule is Match<TScopeName, TRegexStr, TRefName>
    {
        return (<any>rule).match && !(<any>rule).begin && !(<any>rule).include;
    }

    export interface BeginEnd<TScopeName, TRegexStr, TRefName> extends RuleCommon<TScopeName, TRegexStr, TRefName>
    {
        /** a regular expression pattern that starts a block
         *  togather with end, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        begin: TRegexStr;

        /** a regular expression pattern that ends a block
         *  togather with begin, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        end: TRegexStr;

        /** key allow you to assign attributes to the captures of the begin patterns. */
        beginCaptures?: { [index in CaptureID]?: Rule<TScopeName, TRegexStr, TRefName> | { name: TScopeName }; };

        /** key allow you to assign attributes to the captures of the end patterns. */
        endCaptures?: { [index in CaptureID]?: Rule<TScopeName, TRegexStr, TRefName> | { name: TScopeName }; };

        /** a short-hand allow you to assign attributes to the captures of the begin and end patterns with same values. */
        captures?: { [index in CaptureID]?: Rule<TScopeName, TRegexStr, TRefName> | { name: TScopeName }; };

        /** this key is similar to the name key but only assigns the name to the text between what is matched by the begin/end patterns. */
        contentName?: TScopeName;

        /** array of the actual rules used to parse the document. */
        patterns?: ReadonlyArray<Rule<TScopeName, TRegexStr, TRefName>>;

        applyEndPatternLast?: boolean;

    }

    export function IsBeginEndRule<TScopeName, TRegexStr, TRefName>(rule: BeginEnd<TScopeName, TRegexStr, TRefName>): rule is BeginEnd<TScopeName, TRegexStr, TRefName>
    {
        return !(<any>rule).match && (<any>rule).begin && (<any>rule).end && !(<any>rule).while && !(<any>rule).include;
    }

    export interface BeginWhile<TScopeName, TRegexStr, TRefName> extends RuleCommon<TScopeName, TRegexStr, TRefName>
    {
        /** a regular expression pattern that starts a block
         *  togather with end, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        begin: TRegexStr;

        /** a regular expression pattern that ends a block
         *  togather with begin, allow matches which span several lines and must both be mutually exclusive with the match key.*/
        while: TRegexStr;

        /** a short-hand allow you to assign attributes to the captures of the begin and end patterns with same values. */
        captures?: { [index in CaptureID]?: Rule<TScopeName, TRegexStr, TRefName> | { name: TScopeName }; };

        /** array of the actual rules used to parse the document. */
        patterns?: Array<Rule<TScopeName, TRegexStr, TRefName>>;
    }

    export function IsBeginWhileRule<TScopeName, TRegexStr, TRefName>(rule: BeginWhile<TScopeName, TRegexStr, TRefName>): rule is BeginWhile<TScopeName, TRegexStr, TRefName>
    {
        return !(<any>rule).match && (<any>rule).begin && (<any>rule).while && !(<any>rule).end && !(<any>rule).include;
    }

    export interface Include<TRefName>
    {
        /** this allows you to reference a different language, recursively reference the grammar itself or a rule declared in this file’s repository. 
         *  1.To reference another language, use the scope name of that language.
         *  2.To reference the grammar itself, use $self.
         *  3.To reference a rule from the current grammars repository, prefix the name with a pound sign (#).
        */
        include: TRefName;
    }

    export function IsIncludeRule<TRefName>(rule: Include<TRefName>): rule is Include<TRefName>
    {
        return (<any>rule).include !== undefined;
    }

    export type Repository<TScopeName, TRegexStr, TRefName> = { [key: string]: Rule<TScopeName, TRegexStr, TRefName> };
    export type Captures<TScopeName, TRegexStr, TRefName> = { [index in CaptureID]?: Rule<TScopeName, TRegexStr, TRefName> | { name: TScopeName }; };

    export type RawGrammar = Grammar<string, string, string>;
    export type RawRule = Rule<string, string, string>;
    export type RawCaptrues = Captures<string, string, string>;

    export type ValidGrammar = Grammar<TokenName, OnigScanner, RefName> & { displayName?: string; allRules: () => Array<ValidRule>; allRepoRules: () => Map<string, ValidRule>; };
    export type ValidRule = Rule<TokenName, OnigScanner, RefName> & { key: string; index: number; parent: ValidGrammar | ValidRule };
    export type ValidCaptrues = Captures<TokenName, OnigScanner, RefName>;

    export function IsValidated(grammar: RawGrammar | ValidGrammar): grammar is ValidGrammar
    { return grammar.scopeName instanceof ScopeName; }

    export function LoadRaw(src: string): RawGrammar | undefined
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
    export function ToJSON(grammar: ValidGrammar): string
    {
        return JSON.stringify(grammar, function (this: any, k: string, v: any): any
        {
            if (this.scopeName !== undefined)
            {

            }
        });
    }

    export function Validate(raw: RawGrammar): ValidGrammar
    {
        var asValid = raw as unknown as ValidGrammar;

        var findAllRules = function (this: ValidGrammar, allRules?: Array<ValidRule>): Array<ValidRule>
        {
            if (!allRules)
            {
                let baseRule = this as unknown as ValidRule;
                allRules = [baseRule];
            }
            if (!this) { return allRules; }
            let [patterns, repo, ...caps] =
                [
                    this.patterns,
                    this.repository,
                    (this as any).beginCaptures,
                    (this as any).endCaptures,
                    (this as any).captures
                ];
            if (patterns)
            {
                for (let i = 0, len = patterns.length; i < len; i++)
                { let r = patterns[i]; allRules.push(r as any); findAllRules.call(r as any, allRules); }
            }
            if (repo)
            {
                for (const key in repo)
                { let r = repo[key]; allRules.push(r as any); findAllRules.call(r as any, allRules); }
            }
            for (let i = 0, len = caps.length; i < len; i++)
            {
                let cap = caps[i];
                if (cap)
                {
                    for (const id in cap)
                    { let r = cap[id as CaptureID]; allRules.push(r); findAllRules.call(r, allRules); }
                }
            }
            return allRules;
        };
        asValid.allRules = findAllRules;

        var findRepoRules = function (this: ValidGrammar, repoRules?: Map<string, ValidRule>): Map<string, ValidRule>
        {
            if (!repoRules)
            {
                let baseRule = this as unknown as ValidRule;
                repoRules = new Map<string, ValidRule>();
                repoRules.set(this.scopeName.toString(), baseRule);
            }
            if (!this) { return repoRules; }
            let [patterns, repo, ...caps] =
                [
                    this.patterns,
                    this.repository,
                    (this as any).beginCaptures,
                    (this as any).endCaptures,
                    (this as any).captures
                ];
            if (patterns)
            {
                for (let i = 0, len = patterns.length; i < len; i++)
                { findRepoRules.call(patterns[i] as any, repoRules); }
            }
            if (repo)
            {
                for (const key in repo)
                { let r = repo[key] as any; repoRules.set(r.key, r); findRepoRules.call(r, repoRules); }
            }
            for (let i = 0, len = caps.length; i < len; i++)
            {
                let cap = caps[i];
                if (cap)
                {
                    for (const id in cap)
                    { findRepoRules.call(cap[id as CaptureID], repoRules); }
                }
            }
            return repoRules;
        };
        asValid.allRepoRules = findRepoRules;

        var errors = new Array<string>();
        var index = 0;
        let validateRule = function (rule: RawRule)
        {
            if (rule)
            {
                (rule as ValidRule).index = index++;
                let [name, contentName, patterns, repo, match, begin, end, include, ...caps] =
                    [
                        (rule as any).name as string,
                        (rule as any).contentName as string,
                        (rule as any).patterns as Array<RawRule>,
                        (rule as any).repository,
                        (rule as any).match as string,
                        (rule as any).begin as string,
                        (rule as any).end as string,
                        (rule as any).include as string,
                        (rule as any).beginCaptures,
                        (rule as any).endCaptures,
                        (rule as any).captures
                    ];
                if (name) { try { (rule as any).name = new ScopeName(name); } catch (e) { errors.push(`invalid scope name: ${e.toString()}`); } }
                if (contentName) { try { (rule as any).contentName = new ScopeName(name); } catch (e) { errors.push(`invalid scope name: ${e.toString()}`); } }
                if (match) { try { (rule as any).match = new OnigScanner(match); } catch (e) { errors.push(`invalid onigruruma regex ${match}`); } }
                if (begin) { try { (rule as any).begin = new OnigScanner(begin); } catch (e) { errors.push(`invalid onigruruma regex ${begin}`); } }
                if (end) { try { (rule as any).end = new OnigScanner(end); } catch (e) { errors.push(`invalid onigruruma regex ${end}`); } }
                if (include) { try { (rule as any).include = new RefName(include); } catch (e) { errors.push(`invalid invlude name ${include}`); } }
                if (patterns)
                {
                    for (let i = 0, len = patterns.length; i < len; i++)
                    {
                        let r = patterns[i];
                        if (r)
                        {
                            validateRule(r);
                            (r as any).parent = rule;
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
                            try { TestCaptureID(id); } catch (e) { errors.push(`invalid capture id ${id}`); }
                            let r = cap[id as CaptureID];
                            if (r)
                            {
                                validateRule(r);
                                r.parent = rule;
                            }
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
                            validateRule(r);
                            r.key = key;
                            r.parent = rule;
                        }
                    }
                }
            }
        };

        let [patterns, repo, scopeName] = [raw.patterns, raw.repository, raw.scopeName];
        try
        {
            asValid.displayName = raw.name;
            asValid.scopeName = asValid.name = new ScopeName(scopeName);
        }
        catch (e) { errors.push(`invalid scope name: ${e.toString()}`); }
        if (patterns)
        {
            for (let i = 0, len = patterns.length; i < len; i++)
            {
                let p = patterns[i];
                validateRule(p);
                (p as ValidRule).parent = asValid;
            }
        }
        if (repo)
        {
            for (const key in repo)
            { let nr = repo[key]; validateRule(nr); (nr as any).key = key; }
        }
        if (errors.length > 0) { throw new Error(errors.join('\n')); }
        return raw as unknown as ValidGrammar;
    }

    export function BuildScopeLiterialType(tm: RawGrammar | ValidGrammar, typeName?: string): string
    {
        let out = `type ${typeName === undefined ? "TokenNames" : typeName} = `;
        for (const name of GetScopeNameSet(tm)) { out += `'${name}' | `; }
        return out.slice(0, out.lastIndexOf(" | ")) + ";";
    }

    export function GetScopeNameSet(tm: RawGrammar | ValidGrammar): Set<string>
    {
        var names: Set<string> = new Set<string>();
        let findNameInRule = function (rule: RawRule | ValidRule)
        {
            if (rule)
            {
                let [name, contentName, patterns, repo, ...caps] =
                    [
                        (rule as any).name,
                        (rule as any).contentName,
                        (rule as any).patterns,
                        (rule as any).repository,
                        (rule as any).beginCaptures,
                        (rule as any).endCaptures,
                        (rule as any).captures
                    ];
                if (name) { names.add(name.toString()); }
                if (contentName) { names.add(contentName.toString()); }
                if (repo) { for (const key in repo) { findNameInRule(repo[key]); } }
                if (patterns) { for (let i = 0, len = patterns.length; i < len; i++) { findNameInRule(patterns[i]); } }
                for (let i = 0, len = caps.length; i < len; i++)
                {
                    let cap = caps[i];
                    if (cap) { for (const id in cap) { findNameInRule(cap[id as CaptureID]); } }
                }
            }
        };

        let [patterns, repo] = [tm.patterns, tm.repository];
        if (patterns) { for (let i = 0, len = patterns.length; i < len; i++) { findNameInRule(patterns[i] as any); } }
        if (repo) { for (const key in repo) { findNameInRule(repo[key] as any); } }
        return names;
    }

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

let b = { b: 2, c: 3, toString: () => "oB" };
let a = { a: 1, b, toString: () => "oA" };
let s = JSON.stringify(a, function (this: any, k: any, v: any)
{
    if (this.a === 1)
    { console.log(`${this}|${k}|${v}`); }
    //return this;
    //return { [k]: v };
    return typeof v === 'function' ? v.name : v;
});
console.log(s);