import { File } from '../files/File';
import { escapeRegExp } from '../utils/Utils';
import Binding from './Binding';
import { BindingType, BindingSendMode } from './BindingType';

import {
  addCorruptVMType,
  addXmlBindingUnknownFunctionArgs,
  addXMLTagErrorCorruptXMLElement,
  addXMLTagErrorCouldMissingEndBrackets,
  addXMLTagErrorCouldNotParseBinding,
  addXMLTagErrorCouldNotParseBindingDetailsForField,
  addXMLTagErrorCouldNotParseBindingModeDetailsForField,
  addXMLTagErrorCouldNotParseBindingTransformFunctionForField,
  addXMLTagErrorCouldNotParseIsFiringOnceForField as addXMLTagErrorCouldNotParseBindingSettings,
  addXMLTagErrorCouldNotParsefireOnSetForField
} from '../utils/Diagnostics';
import { Range } from 'brighterscript';

let bindingTypeTextMap = {
  onewaytarget: BindingType.oneWayTarget,
  twoway: BindingType.twoWay,
  onewaysource: BindingType.oneWaySource
};

export class XMLTag {
  constructor(xmlElement: any, tagText: string, file: File) {
    if (!xmlElement || !tagText) {
      addXMLTagErrorCorruptXMLElement(file, tagText);
    }

    this.startPosition = xmlElement.startTagPosition;
    this.endPosition = xmlElement.endTagPosition;

    this._file = file;
    this.text = tagText;
    this.isTopTag = xmlElement.name.toLowerCase() === 'field';
    let tagLength = tagText.length;
    this.bindings = this.getBindings(xmlElement, tagText);

    let that = this;
    this.bindings.forEach((b) => {
      if (b.properties.type === BindingType.code) {
        const pattern = `(${b.isTopBinding ? 'value' : b.nodeField})(\\s*)=(\\s*)((?:"|'){{=${escapeRegExp(b.rawValueText)}}}(?:"|'))`;
        const regex = new RegExp(pattern, 'gim');
        that.text = that.text.replace(regex, (m, m1, m2, m3, m4) => {
          return ''.padEnd(m1.length) + m2 + m3 + ''.padEnd(m4.length + 1);
        });
      } else {
        const regex = new RegExp(`(${b.isTopBinding ? 'value' : b.nodeField})(\\s*)=(\\s*)((?:"|')${escapeRegExp(b.rawValueText)}(?:"|'))`, 'gim');
        that.text = that.text.replace(regex, (m, m1, m2, m3, m4) => {
          return ''.padEnd(m1.length) + m2 + m3 + ''.padEnd(m4.length + 1);
        });
      }
    });
    if (this.text.length < tagLength) {
      this.text = this.text.padEnd(tagLength - this.text.length);
    }
  }

  private _file: File;
  public bindings: Binding[];
  public hasBindings: boolean;
  public startPosition: number;
  public endPosition: number;
  public line: number;
  public column: number;
  public id: string;
  public text: string;
  public isTopTag: boolean;

  public getBindings(xmlElement: any, tagText: string): Binding[] {
    const staticRegex = new RegExp('^{(\\{\\:|\\{\\=)+(.*)(\\})+\\}$', 'i');
    const regex = new RegExp('^\\{([\\(\\{\\[])+(.*)([\\}\\)\\]])+\\}$', 'i');

    this.id = xmlElement.attr.id;
    const bindings = [];
    let tagLines = tagText.split('\n');
    let numLines = tagLines.length;

    for (const attribute in xmlElement.attr) {
      const lineNumber = 1 + xmlElement.line - (numLines - tagLines.findIndex((v) => new RegExp('^(( |\\t)*)' + attribute + '(( |\\t)*)=').test(v)));
      if (attribute.toLowerCase() !== 'id') {
        let matches = staticRegex.exec(xmlElement.attr[attribute]);
        matches = matches || regex.exec(xmlElement.attr[attribute]);
        const colRegex = new RegExp('^((?: *|\\t*)' + attribute + '(?: *|\\t*)=(?: *|\\t*)*(?:"|\'))', 'gim');
        const colMatches = colRegex.exec(tagText);
        let col = colMatches && colMatches.length > 1 && colMatches[1] ? colMatches[1].length : 0;
        const bindingText = matches && matches.length > 2 ? matches[2] : null;
        const bindingStartType = matches && matches.length > 1 ? matches[1] : null;
        const bindingEndType = matches && matches.length > 3 ? matches[3] : null;
        col += bindingStartType ? bindingStartType.length + 1 : 0;
        let mode = this.getBindingMode(bindingStartType, bindingEndType);

        if (bindingText) {
          if (mode === BindingType.invalid && bindingStartType) {
            addXMLTagErrorCouldMissingEndBrackets(this._file, tagText, lineNumber, col);
            continue;
          }
          const binding = new Binding(this._file);
          binding.nodeId = this.isTopTag ? 'top' : this.id;
          binding.nodeField = this.isTopTag ? this.id : attribute;
          binding.isTopBinding = this.isTopTag;

          if (binding.properties.type === BindingType.invalid) {
            binding.properties.type = mode;
          }
          binding.line = lineNumber;
          binding.char = col;
          binding.endChar = col + bindingText.length;

          if (mode === BindingType.code) {
            const value = xmlElement.attr[this.isTopTag ? 'value' : attribute];
            binding.rawValueText = value.substring(3, value.length - 2);
          }
          else if (mode === BindingType.twoWay) {
            //have to rip out 2 way bindings like {getField}(setCallback)
            //and  make 2 sub bindings
            let parts = /(.*)\| *(.*)/.exec(bindingText);
            if (parts && parts.length > 2) {
              binding.createBinding(true);
              binding.createBinding(false);
              this.parseSubBindingText(parts[1], binding.getBinding);
              this.parseSubBindingText(parts[2], binding.setBinding);
              binding.rawValueText = xmlElement.attr[this.isTopTag ? 'value' : attribute];
            }
          } else {
            this.parseBindingText(bindingText, binding, tagText, xmlElement, attribute);
          }

          binding.validate();
          if (binding.isValid) {
            bindings.push(binding);
          } else {
            addXMLTagErrorCouldNotParseBinding(this._file, tagText, binding.errorMessage, binding.line, binding.char);
          }
        } else {
          const startRegex = new RegExp('^\\{([\\(\\{\\[])', 'i');

          if (startRegex.test(xmlElement.attr[attribute])) {
            addXMLTagErrorCouldMissingEndBrackets(this._file, tagText, lineNumber, col);
          }

        }
      }
    }
    this.hasBindings = bindings.length > 0;
    return bindings;
  }

  public parseSubBindingText(text: string, binding: Binding) {
    const parts = text.split(';');
    for (let i = 0; i < parts.length; i++) {
      this.parseBindingPart(i, parts[i].replace(/\s/g, ''), binding, text, binding.line);
    }
    binding.rawValueText = text;
  }
  public parseBindingText(text: string, binding: Binding, tagText: any, xmlElement: any, attribute: any) {
    const parts = text.split(';');
    for (let i = 0; i < parts.length; i++) {
      this.parseBindingPart(i, parts[i].replace(/\s/g, ''), binding, tagText, binding.line);
    }
    binding.rawValueText = xmlElement.attr[this.isTopTag ? 'value' : attribute];
  }

  public parseBindingPart(index: number, partText: string, binding: Binding, tagText: string, line: number) {
    if (index === 0) {
      binding.parseObserveField(partText);
    } else if (partText.toLowerCase().includes('transform=')) {
      //transform function
      let transformFunction = partText.substring(10);
      if (transformFunction.trim()) {
        binding.properties.transformFunction = transformFunction;
      } else {
        addXMLTagErrorCouldNotParseBindingTransformFunctionForField(this._file, partText, tagText, line);
      }
    } else if (partText.toLowerCase().trim() === 'fireonset') {
      binding.properties.fireOnSet = true;
    } else if (partText.toLowerCase().trim() === 'once') {
      binding.properties.isFiringOnce = true;
    } else {
      addXMLTagErrorCouldNotParseBindingSettings(this._file, partText, binding);
    }
  }

  private getBindingMode(bindingStartType: string, bindingEndType: string): BindingType {
    if (bindingStartType === '{' && bindingEndType === '}') {
      return BindingType.oneWaySource;
    } else if (bindingStartType === '(' && bindingEndType === ')') {
      return BindingType.oneWayTarget;
    } else if (bindingStartType === '[' && bindingEndType === ']') {
      return BindingType.twoWay;
    } else if (bindingStartType === '{:' && bindingEndType === '}') {
      return BindingType.static;
    } else if (bindingStartType === '{=' && bindingEndType === '}') {
      return BindingType.code;
    } else {
      return BindingType.invalid;
    }
  }
}
