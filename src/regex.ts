// File: regex.ts                                                                  //
// Project: lieene.tm-grammar                                                      //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Thu Nov 28 2019                                                   //
// Last Modified: Sun Dec 01 2019                                                  //
// Modified By: Lieene Guo                                                         //
import * as L from "@lieene/ts-utility";
import { OnigScanner as scaner, OniStr as ostring, OniRegexSource as oRegex } from "oniguruma-ext";

const HAS_BACK_REFERENCES = /\\(\d+)/;
const BACK_REFERENCING_END = /\\(\d+)/g;
export class OMatcher extends oregex
{
  constructor(pattern: string)
  {
    super(pattern);
  }

  toString(): string { return this.source; }
  get hasBackReferences():boolean { return this.backReferences !== undefined && this.backReferences.length > 0; }

  get hasAnchorA():boolean { return this.anchorA !== undefined && this.anchorA.length > 0; }
  get hasAnchorG():boolean { return this.anchorG !== undefined && this.anchorG.length > 0; }
  get hasAnchorz():boolean { return this.anchorz !== undefined && this.anchorz.length > 0; }

  anchorA?: Array<{ start: number }>;// /A matches begining of the source file
  anchorG?: Array<{ start: number }>;// /G only match position in this line, and while mey break it
  anchorz?: Array<{ start: number }>;// /z shall never be matched in vscode
  //so as end matcher /z force the rule to last to the end of the souce file

  // /Z matched end of current line and it can be used normally
  
  backReferences?: Array<{ start: number, end: number, backIndex: number }>;
}
export interface AnchorCache
{
  A0_G0:oRegex;
  A0_G1:oRegex;
  A1_G0:oRegex;
  A1_G1:oRegex;
}




