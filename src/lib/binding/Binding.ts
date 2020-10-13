import { BrsFile, createRange, isClassMethodStatement, Parser, Position, Range } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';
import { isFunction } from 'util';
import { File } from '../files/File';
import { addXmlBindingUnknownFunctionArgs, addXmlBindingVMFieldNotFound, addXmlBindingVMFunctionNotFound, addXmlBindingVMFunctionWrongArgCount } from '../utils/Diagnostics';

import { BindingProperties } from './BindingProperties';
import { BindingType, BindingSendMode } from './BindingType';
import { expect } from 'chai';

let callArgsMap = new Map([
  [BindingSendMode.none, 0],
  [BindingSendMode.node, 1],
  [BindingSendMode.value, 1],
  [BindingSendMode.both, 2]
]);

export default class Binding {

  constructor(public file: File) {
    this.properties = new BindingProperties();
  }

  public isValid: boolean = false;
  public isTopBinding: boolean = false;
  public observerField: string;
  public nodeId: string;
  public nodeField: string;
  public properties: BindingProperties;
  public errorMessage: string;
  public rawValueText: string;
  public line: number = 0;
  public char: number = 0;
  public startOffset: number = 0;
  public endOffset: number = 0;
  public endChar: number = 99999;
  public isUsingGetterAndSetter = false;

  //for 2 way bindings
  public getBinding: Binding;
  public setBinding: Binding;

  public validate(): boolean {
    this.isValid = this.validateImpl();
    return this.isValid;
  }

  public validateAgainstClass(): boolean {
    if (this.properties.type === BindingType.code) {
      return true;
    }
    if (!this.file.bindingClass) {
      return false;
    }

    if (this.properties.sendMode > BindingSendMode.field) {
      let method = this.file.getMethod(this.observerField);
      if (!isClassMethodStatement(method)) {
        addXmlBindingVMFunctionNotFound(this.file, this);
        this.isValid = false;
      } else {
        let expectedArgs = callArgsMap.get(this.properties.sendMode);
        if (method.func.parameters.length !== expectedArgs) {
          addXmlBindingVMFunctionWrongArgCount(this.file, this, expectedArgs, method.func.parameters.length);
          this.isValid = false;
        }
      }

    } else if (!this.isUsingGetterAndSetter){
      if (!this.file.getField(this.observerField)) {
        addXmlBindingVMFieldNotFound(this.file, this);
        this.isValid = false;
      }
    }
    return this.isValid && (this.getBinding ? this.getBinding.validateAgainstClass() : true) && (this.setBinding ? this.setBinding.validateAgainstClass() : true)
  }

  private validateImpl(): boolean {
    if (this.isUsingGetterAndSetter) {
      this.getBinding.validate();
      this.setBinding.validate();
      return true;
    } else {

      if (!this.nodeId) {
        this.errorMessage = 'node Id is not defined';
        return false;
      }

      if (!this.nodeField) {
        this.errorMessage = 'node field is not defined';
        return false;
      }

      if (!this.observerField && this.properties.type !== BindingType.code) {
        this.errorMessage = 'observer.field is not defined';
        return false;
      }

      if (this.properties.type === BindingType.static || this.properties.type == BindingType.code) {
        
      }

      if (this.properties.transformFunction && this.properties.type !== BindingType.oneWaySource) {
        this.errorMessage = 'Illegal transform function: You can ony use transform function for vm values that are set on a node.'
        return false;
      }

      if (this.properties.type === BindingType.code) {
        let { statements, diagnostics } = Parser.parse(`a=${this.rawValueText}`);
        if (diagnostics.length > 0) {
          this.errorMessage = `Could not parse inline brightscript code: '${diagnostics[0].message}'`;
          return false;
        }
      }
    }

    return true;
  }

  public getInitText(): string | undefined {
    switch (this.properties.type) {
      case BindingType.oneWaySource:
        return this.getOneWaySourceText();
        break;
      case BindingType.oneWayTarget:
        return this.getOneWayTargetText();
        break;
      case BindingType.twoWay:
        if (this.isUsingGetterAndSetter) {
          return this.getBinding.getOneWaySourceText() + '\n' + this.setBinding.getOneWayTargetText();
        } else {
          return this.getOneWaySourceText() + '\n' + this.getOneWayTargetText();
        }
        break;
      case BindingType.static:
        //not part of init
        break;
    }
    return undefined;
  }

  private getOneWaySourceText() {
    return `m.vm.bindField("${this.observerField}", m.${this.nodeId}, "${this.nodeField}", ${this.properties.fireOnSet ? 'true' : 'false'}, ${this.properties.transformFunction || 'invalid'}, ${this.properties.isFiringOnce ? 'true' : 'false'}, "${this.properties.getModeText()}")`;
  }

  private getOneWayTargetText() {
    let funcText = this.properties.sendMode === BindingSendMode.field ? `"${this.observerField}"` : this.observerField;
    return `mc_Tasks_observeNodeField(m.${this.nodeId}, "${this.nodeField}", ${funcText}, "${this.properties.getModeText()}", ${this.properties.isFiringOnce ? 'true' : 'false'}, m.vm)`;

  }

  public getStaticText(): string {
    let text = '';
    if (this.properties.type === BindingType.code) {
      text += `m.${this.nodeId}.${this.nodeField} = ${this.rawValueText}`;
    } else if (this.properties.type === BindingType.static) {
      const valueText = this.observerField.split('.').length > 1 ?
        `MU_getContentField(m.vm,"${this.observerField}")` : `m.vm.${this.observerField}`;
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

    let binding = new Binding(this.file);

    binding.isTopBinding = this.isTopBinding;
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
    this.isUsingGetterAndSetter = true;
  }


  public parseObserveField(partText: string) {
    let regex = /([a-z0-8_]*)(\( *(value *,* *node| *value *| *node *)*\))*/gi;
    let parts = regex.exec(partText);
    this.observerField = parts[1];
    if (parts.length > 2) {
      let callArgs = parts[2] ? parts[2].replace(/ /g, '') : '';
      if (callArgs === '()') {
        this.properties.sendMode = BindingSendMode.none;
      } else if (callArgs === '(value)') {
        this.properties.sendMode = BindingSendMode.value;
      } else if (callArgs === '(node)') {
        this.properties.sendMode = BindingSendMode.node;
      } else if (callArgs === '(value,node)') {
        this.properties.sendMode = BindingSendMode.both;
      } else if (partText.indexOf('(') !== -1) {
        addXmlBindingUnknownFunctionArgs(this.file, this);
      } else {
        this.properties.sendMode = BindingSendMode.field;
      }
    }
  }

}
