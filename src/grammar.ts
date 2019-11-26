
// File: grammar.ts                                                                //
// Project: lieene.tm-grammar                                                      //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Sat Nov 23 2019                                                   //
// Last Modified: Tue Nov 26 2019                                                  //
// Modified By: Lieene Guo                                                         //


import * as L from "@lieene/ts-utility";
import { Text } from "text-editing";
import { Tree, Name } from "poly-tree";
import { OnigScanner } from "oniguruma-ext";
import { Textmate as tm } from "./tm-grammar";
import { promisify } from "util";

export class Grammar
{
    static IsGrammar<T>(obj: T | Grammar): obj is Grammar
    { return (obj as Grammar).tokenizeSource !== undefined; } 

    constructor(src: tm.Grammar | string)
    {
        if (L.IsString(src))
        {
            src = tm.FromJSON(src)!;
            if (src === undefined) { throw new Error("Invalid JSON grammar"); }
        }

        let hasSource = this.abstract = src !== undefined;
        this.scopeName = hasSource ? src.scopeName : L.Uny;
        this.displayName = src.displayName!;
        this.repository = new Map<string, Grammar.Rule>();
        this.patterns = [];
        this.rules = [];
        if (hasSource)
        {
            //TODO: parse TmGrammar;
            LoadedGrammars.set(this.scopeName, this);
        }
    }

    copyFrom(from: Grammar | Tree.NodeType<GrammarRepo>): void
    {
        (this as any).scopeName = from.scopeName;
        (this as any).displayName = from.displayName;
        (this as any).abstract = from.abstract;
        let repo = this.repository as Map<string, Grammar.Rule>;
        repo.clear();
        from.repository.forEach((v, k) => repo.set(k, v));
        (this as any).patterns = from.patterns.map(p => p);
        (this as any).rules = from.rules.map(p => p);
    }

    /** indicates this grammar is a empty placehold in GrammarRepo */
    readonly abstract: boolean;

    readonly displayName: string;
    readonly scopeName: Grammar.TokenName;
    get languageName(): string { return this.scopeName.language; }

    readonly repository: ReadonlyMap<string, Grammar.Rule>;
    readonly patterns: ReadonlyArray<Grammar.Rule>;
    readonly rules: ReadonlyArray<Grammar.Rule>;

    link(): void
    {
        this.repository.forEach(v => v.link(this as unknown as GrammarNode));
        this.patterns.forEach(p => p.link(this as unknown as GrammarNode));
    }

    public findRule(name: string) { return this.repository.get(name); }
    tokenizeSource(source: string | Text, callback: (e: Error, tree: SyntaxTree) => void): void
    {
        var stack: Grammar.MatchStack = [];
    }

    tokenizeSourceAsync = promisify(this.tokenizeSource);

    tokenizeLines(line: string[], stack: Grammar.MatchStack, tree: SyntaxTree): void
    { }

    tokenizeLine(line: string, stack: Grammar.MatchStack, tree: SyntaxTree): void
    { }
}
export namespace Grammar
{
    export import TokenName = tm.ScopeName;
    export function IsTokenName(obj: any): obj is TokenName
    { return Object.getPrototypeOf(obj) === TokenName.prototype; }

    export class MatchStackElem
    {
        constructor(public curRule: Rule, readonly text: Text, pos: Text.Pos | number)
        { [this.pos, this.offset] = L.IsNumber(pos) ? [this.text.convert(pos), pos] : [pos, this.text.convert(pos)]; }
        pos: Text.Pos;
        offset: number;
    }

    export type MatchStack = Array<MatchStackElem>;

    export abstract class Rule
    {
        constructor(readonly grammar: Grammar)
        { }
        abstract link(grammar: GrammarNode): void;
        abstract apply(line: string, stack: MatchStack, tree: SyntaxTree): void;
    }
    export class IncludeRule extends Rule
    {
        constructor(grammar: Grammar, include: tm.RefName)
        {
            super(grammar);
            this.refName = include;
        }

        refName: tm.RefName;
        refRule?: Rule;

        link(grammar: GrammarNode): void
        {
            throw new Error("Method not implemented.");
        }
        apply(line: string, stack: MatchStackElem[], tree: SyntaxTree): void
        {
            throw new Error("Method not implemented.");
        }
    }
}

/** Set of grammar to parse different languages */
export type GrammarRepo = Tree.MorphTreeS<Grammar & { readonly gScope: string }, RepoBuilder.RepoFunc>;
export type GrammarNode = Tree.NodeType<GrammarRepo>;

export var LoadedGrammars: Map<tm.ScopeName, Grammar>;

/** build a new GrammatSet */
export function GrammarRepo(...grammars: Grammar[]): GrammarRepo
{
    let gs = Tree<Grammar & { readonly gScope: string }, RepoBuilder.RepoFunc>(RepoBuilder.RepoFunc());
    gs.root.poly(rootGrammar);
    grammars.forEach(g => gs.setGrammar(g));
    return gs as unknown as Tree.Simplify<typeof gs>;
}
let rootGrammar = { abstract: true, gScope: "global" } as unknown as Grammar;


namespace RepoBuilder
{
    function abstractGrammar(gScope: string): any
    {
        let g: any = new Grammar(L.Uny);
        g.abstract = true;
        g.gScope = gScope;
        return g;
    }
    export function RepoFunc(): RepoFunc
    {
        let rf: RepoFunc = L.Any;

        rf.findGrammar = function (this: Tree.Nomalize<GrammarRepo>, name: Grammar.TokenName | string): Grammar | undefined
        {
            if (L.IsString(name)) { name = new Grammar.TokenName(name); }
            let parts = name.parts;
            let node = this.root;
            for (let i = 0, len = parts.length; i < len; i++)
            {
                let gScope = parts[i];
                let next = node.findChild(n => n.gScope === gScope, false).first!;
                if (next === undefined) { return undefined; }
                node = next;
            }
            return node as unknown as Grammar;
        };

        rf.setGrammar = function (this: Tree.Edit<GrammarRepo>, grammar: Grammar, name?: Grammar.TokenName | string): void
        {
            if (grammar === undefined) { throw new Error("grammar is null"); }
            if (name === undefined) { name = grammar.scopeName; }
            else if (L.IsString(name)) { name = new Grammar.TokenName(name); }
            let parts = name.parts;
            let node = this.root;
            for (let i = 0, len = parts.length, last = len - 1; i < len; i++)
            {
                let gScope = parts[i];
                let next = node.findChild(n => n.gScope === gScope, false).first!;
                if (i !== last)
                {
                    if (next === undefined) { node.push(abstractGrammar(gScope)); }
                    node = next;
                }
                else
                {
                    if (next === undefined) { node.push(grammar, { gScope }); }
                    else { next.copyFrom(grammar); }
                    this.linkGrammars();
                    return;
                }
            }
        };

        rf.removeGrammar = function (this: Tree.Edit<GrammarRepo>, name: Grammar.TokenName | string): void
        {
            let g = this.findGrammar(name) as unknown as Tree.Edit<GrammarNode>;
            if (g !== undefined)
            {
                if (g.childCount === 0) { g.remove(); }
                else { (g as any).abstract = true; }
            }
            this.linkGrammars();
        };

        rf.linkGrammars = function (this: Tree.Nomalize<GrammarRepo>): void
        { this.root.forDecending(c => c.link()); };

        return rf;
    }
    export interface RepoFunc
    {
        findGrammar(name: Grammar.TokenName | string): Grammar | undefined;
        setGrammar(grammar: Grammar, name?: Grammar.TokenName | string): void;
        removeGrammar(name: Grammar.TokenName | string): void;
        linkGrammars(): void;
    }
}

interface TokenExt 
{
    readonly name: Grammar.TokenName;
    readonly rule?: Grammar.Rule;
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

