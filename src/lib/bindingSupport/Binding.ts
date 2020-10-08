import { createRange, Parser, Position, Range } from 'brighterscript';
import { isFunction } from 'util';
import { File } from '../fileProcessing/File';
import { addXmlBindingUnknownFunctionArgs, addXmlBindingVMFieldNotFound, addXmlBindingVMFunctionNotFound, addXmlBindingVMFunctionWrongArgCount } from '../utils/Diagnostics';

import { BindingProperties } from './BindingProperties';
import { BindingType, CallArgs } from './BindingType';

let callArgsMap = new Map([
  [CallArgs.none, 0],
  [CallArgs.node, 1],
  [CallArgs.value, 1],
  [CallArgs.both, 2]
]);

export default class Binding {

  constructor() {
    this.properties = new BindingProperties();
  }

  public isValid: boolean = false;
  public isTopBinding: boolean = false;
  public observerId: string = 'vm';
  public observerField: string;
  public nodeId: string;
  public nodeField: string;
  public properties: BindingProperties;
  public errorMessage: string;
  public rawValueText: string;
  public line: number = 0;
  public char: number = 0;
  public endChar: number = 99999;

  //for 2 way bindings
  public getBinding: Binding;
  public setBinding: Binding;

  public validate(): boolean {
    this.isValid = this.validateImpl();
    return this.isValid;
  }

  public validateAgainstClass(file: File): boolean {
    let cs = file.bindingClass;

    if (this.properties.callArgs > CallArgs.na) {
      let method = cs.methods.find((m) => m.name.text === this.observerField);
      if (!method) {
        addXmlBindingVMFunctionNotFound(file, this);
        this.isValid = false;
      } else {
        let expectedArgs = callArgsMap.get(this.properties.callArgs);
        if (method.func.parameters.length !== expectedArgs) {
          addXmlBindingVMFunctionWrongArgCount(file, this, expectedArgs);
          this.isValid = false;
        }
      }

    } else {
      if (!cs.memberMap[this.observerField.toLowerCase()]) {
        addXmlBindingVMFieldNotFound(file, this);
        this.isValid = false;
      }
    }
    return this.isValid && (this.getBinding ? this.getBinding.validateAgainstClass(file) : true) && (this.setBinding ? this.setBinding.validateAgainstClass(file) : true)
  }

  private validateImpl(): boolean {
    if (!this.nodeId) {
      this.errorMessage = 'node Id is not defined';
      return false;
    }

    if (!this.nodeField) {
      this.errorMessage = 'node field is not defined';
      return false;
    }

    if (!this.observerId && this.properties.type !== BindingType.code) {
      this.errorMessage = 'observer.id is not defined';
      return false;
    }

    if (!this.observerField && this.properties.type !== BindingType.code) {
      this.errorMessage = 'observer.field is not defined';
      return false;
    }

    if (this.properties.type === BindingType.code) {
      let { statements, diagnostics } = Parser.parse(`a=${this.rawValueText}`);
      if (diagnostics.length > 0) {
        this.errorMessage = `Could not parse inline brightscript code: '${diagnostics[0].message}'`;
        return false;
      }
    }

    return true && (this.getBinding ? this.getBinding.validate() : true) && (this.setBinding ? this.setBinding.validate() : true)
  }

  public getInitText(): string | undefined {
    switch (this.properties.type) {
      case BindingType.oneWaySource:
        return `MOM_bindObservableField(m.${this.observerId}, "${this.observerField}", m.${this.nodeId}, "${this.nodeField}", ${this.properties.getBrsText()})`;
        break;
      case BindingType.oneWayTarget:
        return `MOM_bindNodeField(m.${this.nodeId}, "${this.nodeField}", m.${this.observerId}, "${this.observerField}", ${this.properties.getBrsText()})`;
        break;
      case BindingType.twoWay:
        return `MOM_bindFieldTwoWay(m.${this.observerId}, "${this.observerField}", m.${this.nodeId}, "${this.nodeField}", ${this.properties.getBrsText()})`;
        break;
      case BindingType.static:
        //not part of init
        break;
    }
    return undefined;
  }

  public getStaticText(): string {
    let text = '';
    if (this.properties.type === BindingType.code) {
      text += `m.${this.nodeId}.${this.nodeField} = ${this.rawValueText}`;
    } else if (this.properties.type === BindingType.static) {
      const valueText = this.observerField.split('.').length > 1 ?
        `MU_getContentField(m.${this.observerId},"${this.observerField}")` : `m.${this.observerId}.${this.observerField}`;
      if (this.properties.transformFunction) {
        text += `m.${this.nodeId}.${this.nodeField} = ${this.properties.transformFunction}(${valueText})`;
      } else {
        text += `m.${this.nodeId}.${this.nodeField} = ${valueText}`;
      }
    }
    return text;
  }

  public getRange(): Range {
    let range = createRange(Position.create(this.line, this.char));
    range.end.character = this.endChar;
    return range;
  }

  public createBinding(isGet: boolean) {

    let binding = new Binding();

    binding.isTopBinding = this.isTopBinding;
    binding.observerId = this.observerId;
    binding.observerField = this.observerField;
    binding.nodeId = this.nodeId;
    binding.nodeField = this.nodeField;
    binding.properties.type = isGet ? BindingType.oneWaySource : BindingType.oneWayTarget;
    binding.line = this.line;
    binding.char = this.char;
    binding.endChar = this.endChar;
    if (isGet) {
      this.getBinding = binding;
    } else {
      this.setBinding = binding;
    }

  }
}
