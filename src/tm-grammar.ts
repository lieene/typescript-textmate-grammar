// File: textmate-grammar-definition.ts                                            //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Fri Nov 8 2019                                                    //
// Last Modified: Fri Nov 22 2019                                                  //
// Modified By: Lieene Guo                                                         //
import * as L from "@lieene/ts-utility";
export interface TmGrammar
{
    readonly scopeName: TmGrammar.Name;
    readonly name?: string;
    readonly fileTypes?: ReadonlyArray<string>;
    readonly foldingStartMarker?: string;
    readonly foldingStopMarker?: string;
    readonly firstLineMatch?: string;
    readonly uuid?: string;

    readonly patterns: ReadonlyArray<TmGrammar.Rule>;
    readonly repository?: { readonly [key: string]: TmGrammar.Rule };
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
        for (const name of GetTokenNameSet(tm)) { out += `'${name}' | `; }
        return out.slice(0, out.lastIndexOf(" | ")) + ";";
    }

    export function GetTokenNameSet(tm: TmGrammar): Set<string>
    {
        let names: Set<string> = new Set<string>();
        let [p, repo] = [tm.patterns, tm.repository];
        findNameInPatterns(p, names);
        if (repo) { for (const key in repo) { findNameInRule(repo[key], names); } }
        return names;
    }

    function findNameInPatterns(patterns: ReadonlyArray<Rule>, names: Set<string>)
    {
        if (!patterns) { return; }
        for (let i = 0, len = patterns.length; i < len; i++)
        { findNameInRule(patterns[i], names); }
    }

    function findNameInRule(rule: Rule, names: Set<string>)
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

    function findNameInCaptures(cap: CapturesByID, names: Set<string>)
    {
        if (!cap) { return; }
        for (const id in cap)
        {
            let cr = cap[id as CaptureID];
            if (cr)
            {
                let [n, p] = [(cr as any).name, (cr as any).patterns];
                if (n !== undefined) { names.add(n); }
                findNameInPatterns(p, names);
            }
        }
    }


    export type Rule = MatchRule | BeginEndRule | RefRule;

    interface PatternBase
    {
        readonly comment?: string;
        readonly disabled?: number;
        readonly name?: Name;
        readonly patterns?: ReadonlyArray<Rule>;
        readonly while?: string;
    }

    interface BeginEndRule extends PatternBase
    {
        readonly begin: string;
        readonly end?: string;
        readonly beginCaptures?: CapturesByID;
        readonly endCaptures?: CapturesByID;
        readonly captures?: CapturesByID;
        readonly contentName?: Name;
        readonly applyEndPatternLast?: number;
    }

    interface MatchRule extends PatternBase
    {
        readonly match?: string;
        readonly captures?: CapturesByID;
    }

    interface RefRule { readonly include: string; }

    export type CapturesByID = { readonly [index in CaptureID]?: CaptureRule; };

    export type CaptureRule = CaptureName | CaptureSub;

    interface CaptureName { readonly name: Name; }
    interface CaptureSub { readonly patterns: Rule[]; }

    //#region edit------------------------------------------------------------------------
    export interface TmGrammarEdit extends TmGrammar
    {
        setLanguageName(lang: string): void;
        setGrammarName(name: string): void;
        setFileTypes(...types: string[]): void;
        setFirstLineMatch(match: string): void;

        addRootPattern(...patterns: Rule[]): void;
        removeRootPattern(...i: number[]): void;
        getRootPattern(i: number): RuleEdit | undefined;

        addRepositoryPattern(key: string, rule: Rule): void;
        addRepositoryPattern(...patterns: [string, Rule][]): void;
        removeRepositoryPattern(...keys: (string | number)[]): void;
        getRepositoryPattern(key: string | number): RuleEdit | undefined;
    }

    type RuleEdit = TmMatchRuleEdit | TmBeginEndRuleEdit | TmRefRuleEdit;

    interface TmPatternBaseEdit extends PatternBase
    {
        setScopeName(name: string | undefined): void;
        setCommnet(cmt: string | undefined): void;
        enable(): void;
        disable(): void;
        addPattern(...patterns: Rule[]): void;
        removePattern(...i: number[]): void;
        getPattern(i: number): Rule | undefined;
    }

    export interface TmMatchRuleEdit extends TmPatternBaseEdit, MatchRule
    {
        setMatch(match: string): void;

        removeCap(...i: number[]): void;
        addCap(...cap: CaptureRule[]): void;
        getCap(i: number): CapEdit;
    }

    export interface TmBeginEndRuleEdit extends BeginEndRule
    {
        setContentScopeName(name: string | undefined): void;

        setBeginMatch(match: string): void;

        removeBeginCap(...i: number[]): void;
        addBeginCap(...cap: CaptureRule[]): void;
        getBeginCap(i: number): CapEdit;

        setEndMatch(match: string): void;

        removeEndCap(...i: number[]): void;
        addEndCapture(...cap: CaptureRule[]): void;
        getEndCap(i: number): CapEdit;

        removeCap(...i: number[]): void;
        addCap(...cap: CaptureRule[]): void;
        getCap(i: number): CapEdit;

        setApplyEndPatternLast(index: number | undefined): void;
    }

    export interface TmRefRuleEdit extends RefRule
    {
        setReference(name: string): void;
    }

    type CapEdit = TmCaptureEdit | TmCapturePatternsEdit;

    export interface TmCaptureEdit extends CaptureName
    {
        setScopeName(name: string | undefined): void;
    }

    export interface TmCapturePatternsEdit extends CaptureSub
    {
        addPattern(...patterns: Rule[]): void;
        removePattern(...i: number[]): void;
        getPattern(i: number): Rule | undefined;
    }
    //#endregion edit------------------------------------------------------------------------

    export type Name = CommonNames | string;
    //#region literials------------------------------------------------------------------------
    export type CaptureID = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "30";
    export type CommonNames =
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

