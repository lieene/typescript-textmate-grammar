// File: regex.ts                                                                  //
// Project: lieene.tm-grammar                                                      //
// Author: Lieene Guo                                                              //
// MIT License, Copyright (c) 2019 Lieene@ShadeRealm                               //
// Created Date: Thu Nov 28 2019                                                   //
// Last Modified: Thu Nov 28 2019                                                  //
// Modified By: Lieene Guo                                                         //
import * as L from "@lieene/ts-utility";
import { OnigScanner as scaner, OniStr as ostring, OniRegexSource as oregex } from "oniguruma-ext";

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
  anchorz?: Array<{ start: number }>;// /Z matched line end  /z shall never be matched in vscode(so it force the rule to last to the end of the souce file)
  backReferences?: Array<{ start: number, end: number, backIndex: number }>;
}




