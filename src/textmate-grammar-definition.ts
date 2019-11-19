// File: textmate-grammar-definition.ts                                            //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Fri Nov 8 2019                                                    //
// Last Modified: Tue Nov 19 2019                                                  //
// Modified By: Lieene Guo                                                         //

import * as fs from "fs";

export function GrammarDef(path: fs.PathLike): GrammarDef | undefined
{
    try
    {
        const src = fs.readFileSync(path);
        let gd = JSON.parse(src.toString());
        if (gd.scopeName !== undefined) { return gd; }
        else { return undefined; }
    }
    catch (e)
    {
        console.warn(e.toString());
        return undefined;
    }
}

export interface GrammarDef
{
    scopeName: GrammarDef.Name;
    name?: string;
    fileTypes?: string[];
    foldingStartMarker?: string;
    foldingStopMarker?: string;
    firstLineMatch?: string;
    uuid?: string;

    patterns: GrammarDef.Rule[];
    repository?: { [key: string]: GrammarDef.Rule };
}
export namespace GrammarDef
{
    export type Rule = MatchRule | BeginEndRule | RefRule;
    export type CapturesByID = { [index in CaptureID]?: CaptureRule; };

    interface PatternBase
    {
        comment?: string;
        disabled?: number;
        name?: Name;
        patterns?: Rule[];
        while?: string;
    }

    interface BeginEndRule extends PatternBase
    {
        begin: string;
        end?: string;
        beginCaptures?: CapturesByID;
        endCaptures?: CapturesByID;
        captures?: CapturesByID;
        contentName?: Name;
        applyEndPatternLast?: number;
    }

    interface MatchRule extends PatternBase
    {
        match?: string;
        captures?: CapturesByID;
    }

    interface RefRule { include: string; }

    export type CaptureRule = CaptureName | CaptureSub;
    interface CaptureName { name: Name; }
    interface CaptureSub { patterns: Rule[]; }


    export type CaptureID = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "30";
    export type Name = CommonNames | string;
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
}

// import * as jtm from "../../TestsSpace/JSON.tmLanguage.json";
// import * as cstm from "../../TestsSpace/csharp.tmLanguage.json";
// let a: GrammarDef = jtm;
// let b: GrammarDef = cstm;
// let x = b.patterns[0];
// let r = a.repository!.array;

// import fs from "fs";
// let b = fs.readFileSync('d:/GitProject/SRTK/CodeExt/TestsSpace/JSONC.tmLanguage.json');
// let a = JSON.parse(b.toString());
// console.log(a.repository);

