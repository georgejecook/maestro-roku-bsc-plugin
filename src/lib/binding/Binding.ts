import { BrsFile, isClassFieldStatement, isClassMethodStatement, Parser, Position, Range } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';
import { isFunction } from 'util';
import { File } from '../files/File';
import { addXmlBindingUnknownFunctionArgs, addXmlBindingVMFieldNotFound, addXmlBindingVMFieldRequired, addXmlBindingVMFunctionNotFound, addXmlBindingVMFunctionWrongArgCount } from '../utils/Diagnostics';

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
  attribute: import("/home/george/hope/open-source/vsc/brighterscript/dist/parser/SGTypes").SGAttribute;

  constructor(public file: File) {
    this.properties = new BindingProperties();
  }
  tagText: string;
  isParsed: boolean;
  range: Range;

  public isValid: boolean = false;
  public isTopBinding: boolean = false;
  public observerField: string;
  public nodeId: string;
  public nodeField: string;
  public properties: BindingProperties;
  public errorMessage: string;
  public rawValueText: string;
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
      if (this.isValid && this.properties.type === BindingType.oneWaySource && !isClassFieldStatement(this.file.getField(this.observerField))) {
        addXmlBindingVMFieldRequired(this.file, this);
        this.isValid = false;
      }
    }
    return this.isValid && (this.getBinding ? this.getBinding.validateAgainstClass() : true) && (this.setBinding ? this.setBinding.validateAgainstClass() : true)
  }

  private validateImpl(): boolean {
    if (this.isUsingGetterAndSetter) {
      return this.getBinding.validate() && this.setBinding.validate();
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
    return `vm.bindField("${this.observerField}", m.${this.nodeId}, "${this.nodeField}", ${this.properties.fireOnSet ? 'true' : 'false'}, ${this.properties.transformFunction || 'invalid'}, ${this.properties.isFiringOnce ? 'true' : 'false'})`;
  }

  private getOneWayTargetText() {
    let funcText = this.properties.sendMode === BindingSendMode.field ? `"${this.observerField}"` : this.observerField;
    return `mc_Tasks_observeNodeField(m.${this.nodeId}, "${this.nodeField}", vm.${funcText}, "${this.properties.getModeText()}", ${this.properties.isFiringOnce ? 'true' : 'false'}, vm)`;

  }

  public getStaticText(): string {
    let text = '';
    if (this.properties.type === BindingType.code) {
      text += `m.${this.nodeId}.${this.nodeField} = ${this.rawValueText}`;
    } else if (this.properties.type === BindingType.static) {
      const valueText = this.observerField.split('.').length > 1 ?
        `MU_getContentField(vm,"${this.observerField}")` : `vm.${this.observerField}`;
      if (this.properties.transformFunction) {
        text += `m.${this.nodeId}.${this.nodeField} = ${this.properties.transformFunction}(${valueText})`;
      } else {
        text += `m.${this.nodeId}.${this.nodeField} = ${valueText}`;
      }
    }
    return text;
  }

  public createBinding(isGet: boolean) {

    let binding = new Binding(this.file);

    binding.isTopBinding = this.isTopBinding;
    binding.nodeId = this.nodeId;
    binding.nodeField = this.nodeField;
    binding.properties.type = isGet ? BindingType.oneWaySource : BindingType.oneWayTarget;
    binding.range = this.range;
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
