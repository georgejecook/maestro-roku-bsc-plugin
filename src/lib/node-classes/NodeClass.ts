import { BrsFile, ClassStatement, FunctionStatement } from 'brighterscript';


export enum NodeClassType {
  none,
  node,
  task,
}

export class NodeClass {
  constructor(
    public type: NodeClassType,
    public file: BrsFile,
    public classStatement: ClassStatement,
    public func: FunctionStatement,
    public name: string,
    public extendsName: string
  ) {
    this.generatedNodeName = this.name.replace(/[^a-zA-Z0-9]/g, "_");
  }
  public generatedNodeName: string;
}