import { BrsFile, Range, Statement, WalkOptions, WalkVisitor, XmlFile } from 'brighterscript';

import { TranspileState } from 'brighterscript/dist/parser/TranspileState';
import { SourceNode } from 'source-map';

export class RawCodeStatement extends Statement {
  constructor(
    public sourceFile: BrsFile | XmlFile,
    public range: Range = Range.create(1, 1, 1, 99999),
    public source: string
  ) {
    super();
  }

  public transpile(state: TranspileState) {
    return [new SourceNode(
      this.range.start.line + 1,
      this.range.start.character,
      this.sourceFile.pathAbsolute,
      this.source
    )];
  }
  public walk(visitor: WalkVisitor, options: WalkOptions) {
    //nothing to walk
  }
}
