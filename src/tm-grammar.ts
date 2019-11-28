// File: textmate-grammar-definition.ts                                            //
// Project: lieene.CodeFactory                                                     //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Fri Nov 8 2019                                                    //
// Last Modified: Thu Nov 28 2019                                                  //
// Modified By: Lieene Guo                                                         //
import * as L from "@lieene/ts-utility";
import { OniRegexSource as Oregex, OniStr, Match, RawCapture } from "oniguruma-ext";
import { Text } from "text-editing";
import { Name } from "poly-tree";
export namespace Textmate
{
  //#region helper types

  //#region furture feature command
  //https://regex101.com/r/tQeI1f/1
  //const tokenNameTesterWithCmd = /^(?:[\w0-9][\-\w0-9]*|\$(?:\d{1,2}|[\w]+\([\w]+\)))(?:\.(?:[\w0-9][\-\w0-9]*|\$(?:\d{1,2}|[\w]+\([\w]+\))))*$/;
  //https://regex101.com/r/2f16K8/1
  //const tokenNameCmdMatcher = /^\$(?:(\d{1,2})|([\w]+)\(([\w]+)\))$/;
  //#endregion furture feature command
  const tmStandardNamePtn = /[\w0-9][\-\w0-9]*/;
  const tmNameCapturePtn = /\$(?<capidx>\d{1,2})/;
  const tmNamePartPtn = RegExp(`${tmStandardNamePtn.source}|${tmNameCapturePtn.source}`);
  const tokenPartPtn = RegExp(`^(?:${tmNamePartPtn.source})$`);
  //const tokenNamePtn = RegExp(`^(?:${tmNamePartPtn.source})(?:\\.(?:${tmNamePartPtn.source}))*$`);///^(?:[\w0-9][\-\w0-9]*|\$\d{1,2})(?:\.(?:[\w0-9][\-\w0-9]*|\$\d{1,2}))*$/;
  //const tokenNameCapMatcher = /\$\d{1,2}/;

  export class TokenNamePart
  {
    constructor(name: string)
    {
      let m = tokenPartPtn.exec(name);
      if (m)
      {
        this.name = name;
        try { this.capIndex = Number.parseInt(m.groups!['capIndex']); }
        catch (e) { this.capIndex = undefined; }
      }
      else { throw new Error(`$Invalid`); }
    }
    readonly name: string;
    readonly capIndex?: number;
    toString(): string { return this.name; }
  }

  export class TokenName
  {
    constructor(base: TokenName, ...specifications: (string | TokenNamePart)[]);
    constructor(gender: TmCommonNames, ...specifications: (string | TokenNamePart)[]);
    constructor(...specifications: (string | TokenNamePart)[]);
    constructor(raw: string);
    constructor(first: string | TokenNamePart | TokenName, ...specifications: (string | TokenNamePart)[])
    {
      if (first === undefined) { throw new Error('No parameter!'); }
      let lang: TokenNamePart | undefined = undefined;
      let parts = this.parts = L.Uny;
      if (L.IsString(first) && specifications.length === 0)
      {
        let stack: Array<TokenName> = this.scopeStack = [];
        let names = first.split(/\s+/);
        let lastId = names.length - 1;
        for (let i = 0; i <= lastId; i++)
        {
          parts = [];
          names[i].split('.').forEach(p =>
          {
            try { parts.push(new TokenNamePart(p)); }
            catch (e) { throw new Error(`Invalid part [${p}] in name [${names[i]}]`); }
          });
          if (i === lastId)
          {
            this.parts = parts;
            if (stack.length > 0) { stack.push(this); }
            else { this.scopeStack = undefined; }
          }
          else { stack.push(new TokenName(...parts)); }
        }
      }
      else 
      {
        if (first instanceof TokenName)
        {
          let bParts = first.parts;
          parts = bParts.slice(0, bParts.length - 1);
          lang = bParts.last!;
        }
        else { specifications.unshift(first); parts = []; }

        for (let i = 0, len = specifications.length; i < len; i++)//parse all specifications
        {
          let pt = specifications[i];
          if (L.IsString(pt))
          {
            pt.split('.').forEach(p =>
            {
              try { parts.push(new TokenNamePart(p)); }
              catch (e) { throw new Error(`Invalid part [${p}] in name [${pt}]`); }
            });
          }
          else if (pt instanceof TokenNamePart) { parts.push(pt); }
          else { throw new Error(`Invalid part name format ${pt}`); }
        }
        if (lang) { parts.push(lang); }
        this.parts = parts;
      }
    }

    get hasCapture(): boolean { return this.parts.some(p => p.capIndex !== undefined); }

    readonly parts: Array<TokenNamePart>;
    readonly scopeStack?: Array<TokenName>;

    GetNameStack(source: string, match: RawCapture[]): Array<TokenName>
    { return this.scopeStack && this.scopeStack.map(t => t.GetName(source, match)) || []; }

    GetName(source: string, match: RawCapture[]): TokenName
    {
      if (this.hasCapture)
      {
        return new TokenName(...this.parts.map(p =>
        {
          if (p.capIndex !== undefined) 
          {
            let cap = match[p.capIndex];
            if (cap) { return source.slice(cap.start, cap.end); }
            return `$invalid-capture-#${p.capIndex}`;
          }
          else { return p.name; }
        }));
      }
      return this;
    }

    get language(): string { return this.parts.last!.name; }
    get rootScope(): TokenName { return this.scopeStack && this.scopeStack[0] || this; }

    get rawName(): string { return this.parts.join('.'); }
    toString(): string
    { return this.scopeStack && this.scopeStack.map(t => t.rawName).join(' ') || this.rawName; }
  }

  export class StandardName
  {
    constructor(name: string)
    {
      if (tmStandardNamePtn.test(name)) { this.name = name; }
      else { throw new Error(`Invalid Scope name: ${name}`); }
    }
    readonly name: string;
    toString(): string { return this.name; }
  }

  export class ScopeName
  {
    constructor(name: string);
    constructor(gender: string | "text" | "source", language: string, ...specializes: string[]);
    constructor(...args: string[])
    {
      if (args.length === 1) { this.parts = args[0].split('.').map(p => new StandardName(p)); }
      else { this.parts = args.map(p => new StandardName(p)); }
    }
    readonly parts: Array<StandardName>;
    toString(): string { return this.parts.join('.'); }
  }

  export class RefName
  {
    constructor(rule: string | StandardName, mode: "$local");
    constructor(lang: ScopeName, rule: string | StandardName, mode: "$external");
    constructor(lang: ScopeName, mode: "$external");
    constructor(special: "$self" | "$base");
    constructor(raw: string);
    constructor(arg0: ScopeName | StandardName | string | "$self" | "$base", arg1?: string | StandardName | "$external" | "$local", arg2?: "$external")
    {
      if (L.IsString(arg0))
      {
        if (arg0 === "$self" || arg0 === "$base") { this.special = arg0; }
        else if (arg1 === "$local") { this.rule = new StandardName(arg0); }
        else
        {
          if (arg0.startsWith("#"))
          { this.rule = new StandardName(arg0.substring(1)); }
          else 
          {
            let parts = arg0.split("#");
            if (parts[0].length === arg0.length)
            { this.lang = new ScopeName(arg0); }
            else if (parts.length === 2)
            { [this.lang, this.rule] = [new ScopeName(parts[0]), new StandardName(parts[1])]; }
            else { throw new Error(`invalid lang#rule form ${arg0}`); }
          }
        }
      }
      else if (arg1 === "$external") { this.lang = arg0 as ScopeName; }
      else if (arg2 === "$external") { [this.lang, this.rule] = [arg0 as ScopeName, arg1 instanceof StandardName && arg1 || new StandardName(arg1!)]; }
    }
    get isExternal(): boolean { return this.lang !== undefined; }
    get isLocal(): boolean { return this.lang === undefined; }
    get is$self(): boolean { return this.special === "$self"; }
    get is$base(): boolean { return this.special === "$base"; }
    readonly lang?: ScopeName;
    readonly rule?: StandardName;
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
    scopeName: TokenName;

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
    name: TokenName;

    /** A display name of the language that this grammar describes */
    displayName?: string;

    updateRules: () => Array<AnyRule>;
    matchers: () => Array<AnyRule>;
    ruleMap: () => Map<string, Rule>;
  }

  //#region Rules

  export type Rule = GroupRule | MatchRule | BeginEndRule | BeginWhileRule | IncludeRule;
  export type AnyRule = Rule | NameRule;


  export interface RuleCommon extends RuleLocater
  {
    /** comment for this rule */
    comment?: string;

    /** the scoped name which gets assigned to the portion matched.
     *  for unnamed match parent name will be used for the segment of code
     *  the name follows the convention of being a dot-separated name where each new (left-most) part specializes the name
     *  and should generally be derived from one of the standard names. */
    name?: TokenName;
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
    name: TokenName;
  }

  export interface GroupRule extends RuleCommon
  {
    /** an array of Rules in this group. */
    patterns: Array<Rule>;
  }

  export function IsGroupRule(rule: GroupRule): rule is GroupRule
  {
    return (<any>rule).patterns && !(<any>rule).match && !(<any>rule).begin && !(<any>rule).include;
  }

  export interface MatchRule extends RuleCommon
  {
    /** a regular expression which is used to identify the portion of text to which the name should be assigned. */
    match: Oregex;

    /** keys allow you to assign attributes to the captures of the match */
    captures?: Captures;
  }

  export function IsMatchRule(rule: MatchRule): rule is MatchRule
  {
    return (<any>rule).match && !(<any>rule).begin && !(<any>rule).include;
  }

  export interface BeginEndRule extends RuleCommon
  {
    /** a regular expression pattern that starts a block
     *  togather with end, allow matches which span several lines and must both be mutually exclusive with the match key.*/
    begin: Oregex;

    /** a regular expression pattern that ends a block
     *  togather with begin, allow matches which span several lines and must both be mutually exclusive with the match key.*/
    end: Oregex;

    /** key allow you to assign attributes to the captures of the begin patterns. */
    beginCaptures?: Captures;

    /** key allow you to assign attributes to the captures of the end patterns. */
    endCaptures?: Captures;

    /** a short-hand allow you to assign attributes to the captures of the begin and end patterns with same values. */
    captures?: Captures;

    /** this key is similar to the name key but only assigns the name to the text between what is matched by the begin/end patterns. */
    contentName?: TokenName;

    /** array of the actual rules used to parse the document. */
    patterns?: ReadonlyArray<Rule>;

    applyEndPatternLast?: boolean;

  }

  export function IsBeginEndRule(rule: BeginEndRule): rule is BeginEndRule
  {
    return !(<any>rule).match && (<any>rule).begin && (<any>rule).end && !(<any>rule).while && !(<any>rule).include;
  }

  export interface BeginWhileRule extends RuleCommon
  {
    /** a regular expression pattern that starts a block
     *  togather with end, allow matches which span several lines and must both be mutually exclusive with the match key.*/
    begin: Oregex;

    /** a regular expression pattern that ends a block
     *  togather with begin, allow matches which span several lines and must both be mutually exclusive with the match key.*/
    while: Oregex;

    /** key allow you to assign attributes to the captures of the begin patterns. */
    beginCaptures?: Captures;

    /** a short-hand allow you to assign attributes to the captures of the begin and end patterns with same values. */
    captures?: Captures;

    /** array of the actual rules used to parse the document. */
    patterns?: Array<Rule>;
  }

  export function IsBeginWhileRule(rule: BeginWhileRule): rule is BeginWhileRule
  {
    return !(<any>rule).match && (<any>rule).begin && (<any>rule).while && !(<any>rule).end && !(<any>rule).include;
  }

  export interface IncludeRule extends RuleCommon
  {
    /** this allows you to reference a different language, recursively reference the grammar itself or a rule declared in this file’s repository. 
     *  1.To reference another language, use the scope name of that language.
     *  2.To reference the grammar itself, use $self.
     *  3.To reference a rule from the current grammars repository, prefix the name with a pound sign (#).
    */
    include: RefName;
  }

  export function IsIncludeRule(rule: IncludeRule): rule is IncludeRule
  { return (<any>rule).include !== undefined; }

  //#endregion Rules


  //#region JSON
  export function FromJSON(src: string | Text): Grammar | undefined
  {
    try
    {
      var displayName: string = L.Uny;
      let grammar: Grammar = JSON.parse(src.toString(), function (this: any, key: any, value: any)
      {
        if (this.scopeName !== undefined)//Root grammar itself as value
        {
          if (key === "scopeName") { return new ScopeName(value); }
          else if (key === "name") { displayName = value; return value; }
          else { return value; }
        }
        else
        {
          if (key === "name" || key === "contentName")
          {
            try { return new TokenName(value); }
            catch (e) { return "[Invalid Token name]" + value.toString(); }
          }
          else if (key === "match" || key === "begin" || key === "end" || key === "while")
          {
            let oni: Oregex;
            try
            {
              oni = new Oregex(value, true);
              oni.source = value;
              return oni;
            }
            catch (e)
            {
              if (key === "end")
              {
                try//try end with back refference
                {
                  let oni = new Oregex(this.begin.toString() + value, true);//test passed
                  oni.source = value;//set back
                  return oni;
                }
                catch (e) { }
              }
              return "[Invalid oniguruma regex]" + value.toString();
            }
          }
          else if (key === "include")
          {
            try { return new RefName(value); }
            catch (e) { return "[Invalid include]" + value.toString(); }
          }
          else if (key === "captures" || key === "beginCaptures" || key === "endCaptures")
          {
            for (const id in value)
            {
              try { TestCaptureID(id); }
              catch (e) { value[id].name = e.toString(); }
            }
            return value;
          }
          else { return value; }
        }
      });
      grammar.name = grammar.scopeName;
      grammar.displayName = displayName;

      grammar.ruleMap = function ruleMap(this: RuleLocater, repoRules?: Map<string, Rule>): Map<string, Rule>
      {
        if (!repoRules)
        {
          repoRules = new Map<string, Rule>();
          repoRules.set((this as Grammar).scopeName.toString(), this as GroupRule);
        }
        let r: AnyRule;
        //if (!this) { return repoRules; }
        let [patterns, repo, ...caps] =
          [
            (this as GroupRule).patterns,
            (this as GroupRule).repository,
            (this as BeginEndRule).beginCaptures,
            (this as BeginEndRule).endCaptures,
            (this as MatchRule).captures
          ];
        if (patterns)
        {
          for (let i = 0, len = patterns.length; i < len; i++)
          {
            r = patterns[i];
            if (r) { ruleMap.call(r, repoRules); }
          }
        }
        if (repo)
        {
          for (const key in repo)
          {
            r = repo[key];
            if (r) { repoRules.set(key, r); ruleMap.call(r, repoRules); }
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
              if (r) { ruleMap.call(r, repoRules); }
            }
          }
        }
        return repoRules;
      };

      grammar.updateRules = function updateRules(this: RuleLocater, allRules?: Array<AnyRule>): Array<AnyRule>
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
            (this as GroupRule).patterns,
            (this as RuleCommon).repository,
            (this as BeginEndRule).beginCaptures,
            (this as BeginEndRule).endCaptures,
            (this as MatchRule).captures
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
      grammar.updateRules();
      return grammar;
    }
    //catch (e) { throw e; }
    catch (e) { return undefined; }
  }

  export function ToJSON(grammar: Grammar): string
  {
    var displayName: string = L.Uny;
    return JSON.stringify(grammar, function (this: any, key: any, value: any): any
    {
      if (key === "parent" || key === "key" || key === "index")// || key === "updateRules" || key === "ruleMap")//skip helper properties
      { return undefined; }
      else if (this === grammar)
      {
        if (key === "scopeName") { return value.toString(); }
        else if (key === "displayName") { displayName = value; return undefined; }
        else if (key === "name") { return displayName || this.displayName; }
        else if (typeof value !== "function") { return value; }
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
            (rule as BeginEndRule).contentName,
            (rule as GroupRule).patterns,
            (rule as RuleCommon).repository,
            (rule as BeginEndRule).beginCaptures,
            (rule as BeginEndRule).endCaptures,
            (rule as MatchRule).captures
          ];
        if (name)
        {
          if (name.scopeStack) { name.scopeStack.forEach(n => names.add(n.rawName)); }
          else { names.add(name.rawName); }
        }
        if (contentName)
        {
          if (contentName.scopeStack) { contentName.scopeStack.forEach(n => names.add(n.rawName)); }
          else { names.add(contentName.rawName); }
        }
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

export let CaptureID = L.asLiterals([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
  "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
  "60", "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "70", "71", "72", "73", "74", "75", "76", "77", "78", "79",
  "80", "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"]);
// group index greater than 99 shouldn not be used 
// at lest back reference can go to 99 at most /99 is stil a back ref but /100 would be a oct char code (/g100 needed)

export type CaptureID = L.ArrayElemType<typeof CaptureID>;

export let TmCommonNames = L.asLiterals([
  "comment",
  "comment.block",
  "comment.block.documentation",
  "comment.line",
  "comment.line.double-dash",
  "comment.line.double-slash",
  "comment.line.number-sign",
  "comment.line.percentage",
  "constant",
  "constant.character",
  "constant.character.escape",
  "constant.language",
  "constant.numeric",
  "constant.other",
  "constant.regexp",
  "constant.rgb-value",
  "entity",
  "entity.name",
  "entity.name.class",
  "entity.name.function",
  "entity.name.method",
  "entity.name.section",
  "entity.name.selector",
  "entity.name.tag",
  "entity.name.type",
  "entity.other",
  "entity.other.attribute-name",
  "entity.other.inherited-class",
  "invalid",
  "invalid.deprecated",
  "invalid.illegal",
  "keyword",
  "keyword.control",
  "keyword.control.less",
  "keyword.operator",
  "keyword.operator.new",
  "keyword.other",
  "markup",
  "markup.bold",
  "markup.changed",
  "markup.deleted",
  "markup.heading",
  "markup.inline.raw",
  "markup.inserted",
  "markup.italic",
  "markup.list",
  "markup.list.numbered",
  "markup.list.unnumbered",
  "markup.other",
  "markup.punctuation.list.beginning",
  "markup.punctuation.quote.beginning",
  "markup.quote",
  "markup.raw",
  "markup.underline",
  "markup.underline.link",
  "meta",
  "meta.cast",
  "meta.parameter.type.variable",
  "meta.preprocessor",
  "meta.preprocessor.numeric",
  "meta.preprocessor.string",
  "meta.return-type",
  "meta.selector",
  "meta.tag",
  "meta.type.annotation",
  "meta.type.name",
  "storage",
  "storage.modifier",
  "storage.type",
  "string",
  "string.html",
  "string.interpolated",
  "string.jade",
  "string.other",
  "string.quoted",
  "string.quoted.double",
  "string.quoted.other",
  "string.quoted.single",
  "string.quoted.triple",
  "string.regexp",
  "string.unquoted",
  "string.xml",
  "string.yaml",
  "support",
  "support.class",
  "support.constant",
  "support.function",
  "support.other",
  "support.type",
  "support.variable",
  "variable",
  "variable.language",
  "variable.name",
  "variable.other",
  "variable.parameter"
]);

export type TmCommonNames = L.ArrayElemType<typeof TmCommonNames>;

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

