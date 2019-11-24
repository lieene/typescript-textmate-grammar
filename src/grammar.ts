// File: grammar.ts                                                                //
// Project: lieene.tm-grammar                                                      //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Sat Nov 23 2019                                                   //
// Last Modified: Sat Nov 23 2019                                                  //
// Modified By: Lieene Guo                                                         //


import * as L from "@lieene/ts-utility";
import { Text } from "text-editing";
import { Tree, Name } from "poly-tree";
import { OnigScanner } from "oniguruma-ext";
import { TmGrammar } from "./tm-grammar";
import { type } from "os";
import { promisify } from "util";

export class Grammar
{
    static IsGrammar<T>(obj: T | Grammar): obj is Grammar
    { return (obj as Grammar).tokenizeSource !== undefined; }

    constructor(src: TmGrammar)
    {
        let hasSource = this.abstract = src !== undefined;
        this.scopeName = hasSource ? new Grammar.TokenName(src.scopeName) : L.Uny;
        this.displayName = this.scopeName.language;
        this.repo = new Map<string, Grammar.Rule>();
        this.ptns = [];
        if (hasSource)
        {
            //TODO: parse TmGrammar;
        }
    }

    copyFrom(from: Grammar | Tree.NodeType<GrammarRepo>): void
    {
        (this as any).tmSource = from.tmSource;
        (this as any).scopeName = from.scopeName;
        (this as any).displayName = from.displayName;
        (this as any).abstract = from.abstract;
        this.repo.clear();
        from.repository.forEach((v, k) => this.repo.set(k, v));
        this.ptns = from.patterns.map(p => p);
    }

    readonly tmSource?: TmGrammar;
    readonly abstract: boolean;

    readonly displayName: string;
    readonly scopeName: Grammar.TokenName;
    get languageName(): string { return this.scopeName.language; }

    protected repo: Map<string, Grammar.Rule>;
    public get repository(): ReadonlyMap<string, Grammar.Rule> { return this.repo; }

    protected ptns: Array<Grammar.Rule>;
    public get patterns(): ReadonlyArray<Grammar.Rule> { return this.ptns; }

    link(): void
    {
        this.repo.forEach(v => v.link(this as unknown as GrammarNode));
        this.ptns.forEach(p => p.link(this as unknown as GrammarNode));
    }

    public findRule(name: string) { return this.repo.get(name); }

    tokenizeSource(source: string | Text): SyntaxTree
    { }

    tokenizeLines(line: string[], parent?: SyntaxTree.Token): Tree.NodeType<SyntaxTree>
    { }

    tokenizeLine(line: string, parent?: SyntaxTree.Token): Tree.NodeType<SyntaxTree>
    { }
}
export namespace Grammar
{
    const scopeNamePattern = /^[\w0-9]+(?:\.[\w0-9]+)*$/;
    export class TokenName
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
    }
    export function IsTokenName(obj: any): obj is TokenName
    { return Object.getPrototypeOf(obj) === TokenName.prototype; }

    export abstract class Rule
    {
        abstract link(gramma: GrammarNode): void;
        abstract apply(source: string, pos: number, callBack: (e: Error, rule: Rule, token: TokenExt) => void): void;
        abstract applyDebug(source: string, pos: number, callBack: (e: Error, rule: Rule, token: TokenExt) => void): void;
        applyAsync = promisify(this.apply);
        applyDebugAsync = promisify(this.applyDebug);
    }
}

/** Set of grammar to parse different languages */
export type GrammarRepo = Tree.MorphTreeS<Grammar & { readonly gScope: string }, RepoBuilder.RepoFunc>;
export type GrammarNode = Tree.NodeType<GrammarRepo>;

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

    function abstractGrammar(gScope: string): any
    {
        let g: any = new Grammar(L.Uny);
        g.abstract = true;
        g.gScope = gScope;
        return g;
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

