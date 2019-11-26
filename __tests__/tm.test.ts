import { Textmate } from "../src/tm-grammar";
import * as fs from "fs";

test("grammar test", () =>
{
    //let grammarSrc = fs.readFileSync(__dirname + "/syntaxes/JSON.tmLanguage.json").toString();
    let grammarSrc = fs.readFileSync(__dirname + "/syntaxes/cpp.tmLanguage.json").toString();
    let grammar = Textmate.FromJSON(grammarSrc)!;
    let tokenNameType = Textmate.BuildScopeLiterialType(grammar);
    console.log(tokenNameType);
    console.log(grammar);
});

// test("test JSON", () =>
// {
//     let b = { b: 2, c: 3, toString: () => "oB" };
//     let a = { a: 1, b, toString: () => "oA" };
//     let s = JSON.stringify(a, function (this: any, k: any, v: any)
//     {
//         console.log(`${this}.${k}:${v}`);
//         //return this;
//         //return { [k]: v };
//         return typeof v === 'function' ? v.name : v;
//     });
//     console.log(s);

//     let x = `{"a":1,"b":{"x":10,"y":20},"c":2}`;
//     let j = JSON.parse(x, function (this: any, k: any, v: any)
//     {
//         console.log(`${this}.${k}:${v}`);
//         return v;
//     });
//     console.log(j);
// });
