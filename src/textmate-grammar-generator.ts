// File: textmate-grammar-generator.ts                                             //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Thu Nov 7 2019                                                    //
// Last Modified: Tue Nov 19 2019                                                  //
// Modified By: Lieene Guo                                                         //

import * as L from "@lieene/ts-utility";
import { Text } from "./text-file";
import { Tree, Name } from "poly-tree";
import { GrammarDef } from "./textmate-grammar-definition";
import * as fs from "fs";

// export interface Scope
// {
//     [part: string]: Scope;
// }
export interface Grammar
{
    readonly def: GrammarDef;
    TokenizeSource(source: string): Tree.MorphTreeN<Grammar.Token>;
    TokenizeLines(line: string[], parent?: Tree.MorphNodeN<Grammar.Token>): Tree.MorphNodeN<Grammar.Token>;
    TokenizeLine(line: string, parent?: Tree.MorphNodeN<Grammar.Token>): Tree.MorphNodeN<Grammar.Token>;
}
export namespace Grammar
{
    export interface ScopeName
    {
        readonly name: string;
        readonly parts: ReadonlyArray<string>;
        readonly language: string;
        readonly scopeType: string;
        [Symbol.iterator](): IterableIterator<string>;
    }

    export interface Token 
    {
        readonly scopeName: ScopeName;
        readonly span: Text.Span;
    }

    export function GenerateGrammar(grammarDef: GrammarDef): Grammar | undefined
    {
        return;
    }

}

namespace core
{
    const scopeNamePattern = /^[\w0-9]+(?:\.[\w0-9]+)*$/;
    export class ScopeName implements Grammar.ScopeName
    {
        constructor(public name: string)
        {
            if (!scopeNamePattern.test(name)) { throw new Error(`invalid scope name: ${name}`); }
            this.parts = name.split('.');
            this.language = this.parts.last!;
            this.scopeType = this.parts.first!;
        }
        public parts: Array<string>;
        public language: string;
        public scopeType: string;
        *[Symbol.iterator](): IterableIterator<string>
        { for (let i = 0, l = this.parts.length; i < l; i++) { yield this.parts[i]; } }
    }
}
