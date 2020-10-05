import { createRange, Parser, Position, Range } from 'brighterscript';

import { BindingProperties } from './BindingProperties';
import { BindingType } from './BindingType';

export default class Binding {

  constructor() {
    this.properties = new BindingProperties();
  }

  public isValid: boolean = false;
  public isFunctionBinding: boolean = false;
  public isTopBinding: boolean = false;
  public observerId: string;
  public observerField: string;
  public nodeId: string;
  public nodeField: string;
  public properties: BindingProperties;
  public errorMessage: string;
  public rawValueText: string;
  public line: number = 0;
  public char: number = 0;
  public endChar: number = 99999;

  public validate() {
    this.isValid = this.validateImpl();
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

    if (this.isFunctionBinding && this.properties.type !== BindingType.oneWayTarget) {
      this.errorMessage = 'observer callbacks on functions are only supported for oneWayTarget (i.e. node to vm) bindings';
      return false;
    }

    if (this.properties.type === BindingType.code) {
      let { statements, diagnostics } = Parser.parse(`a=${this.rawValueText}`);
      if (diagnostics.length > 0) {
        this.errorMessage = `Could not parse inline brightscript code: '${diagnostics[0].message}'`;
        return false;
      }
    }

    return true;
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
}
