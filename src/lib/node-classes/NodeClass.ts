import { BrsFile, ClassStatement, FunctionStatement, XmlFile } from 'brighterscript';


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
  public xmlFile: XmlFile;
  public brsFile: BrsFile;

  resetDiagnostics() {
    if (this.xmlFile) {
      (this.xmlFile as any).diagnostics = [];
    }
    if (this.brsFile) {
      (this.brsFile as any).diagnostics = [];
    }
  }

}