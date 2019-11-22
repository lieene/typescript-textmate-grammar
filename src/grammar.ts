// File: textmate-grammar-generator.ts                                             //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Thu Nov 7 2019                                                    //
// Last Modified: Fri Nov 22 2019                                                  //
// Modified By: Lieene Guo                                                         //

import * as L from "@lieene/ts-utility";
import { Text } from "text-editing";
import { Tree } from "poly-tree";
import { OnigScanner } from "oniguruma-ext";
import { TmGrammar } from "./tm-grammar";


export class Grammar
{
    constructor(readonly src: TmGrammar)
    { }

    TokenizeSource(source: string | Text): SyntaxTree
    { }

    TokenizeLines(line: string[], parent?: SyntaxTree.Token): Tree.NodeType<SyntaxTree>
    { }

    TokenizeLine(line: string, parent?: SyntaxTree.Token): Tree.NodeType<SyntaxTree>
    { }
}
export namespace Grammar
{
    const scopeNamePattern = /^[\w0-9]+(?:\.[\w0-9]+)*$/;
    export class ScopeName
    {
        constructor(public name: string)
        {
            if (!scopeNamePattern.test(name)) { throw new Error(`invalid scope name: ${name}`); }
            this.parts = name.split('.');
            this.language = this.parts.last!;
            this.scopeType = this.parts.first!;
        }
        readonly parts: ReadonlyArray<string>;
        readonly language: string;
        readonly scopeType: string;
    }

    export class Scope
    {
        constructor(name: ScopeName | string)
        {
            this.name = L.IsString(name) ? new ScopeName(name) : name;
        }
        readonly name: ScopeName;
    }
}

interface TokenExt 
{
    readonly scope: Grammar.Scope;
    readonly span: Text.Span;
}

export interface SyntaxTree extends Tree.MorphTreeNS<TokenExt>
{
    source: Text;
    TokenAt(pos: Text.Pos | number): SyntaxTree.Token | undefined;
}

export namespace SyntaxTree
{
    export type Token = Tree.NodeType<SyntaxTree>;

}

