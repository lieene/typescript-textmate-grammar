import { TmGrammar } from "../src/tmgrammar";
import * as fs from "fs";

test("grammar test", () =>
{
    let grammarSrc=fs.readFileSync(__dirname + "/syntaxes/JSON.tmLanguage.json").toString();
    let grammar=TmGrammar.LoadRaw(grammarSrc)!;
    let tokenNameType= TmGrammar.BuildTokenLiterialType(grammar);
    console.log(tokenNameType);
});