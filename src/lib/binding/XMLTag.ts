import type { File } from '../files/File';
import Binding from './Binding';
import { BindingType } from './BindingType';

import { addXMLTagErrorCorruptXMLElement,
    addXMLTagErrorCouldMissingEndBrackets,
    addXMLTagErrorCouldNotParseBinding,
    addXMLTagErrorCouldNotParseBindingTransformFunctionForField,
    addXMLTagErrorCouldNotParseIsFiringOnceForField as addXMLTagErrorCouldNotParseBindingSettings } from '../utils/Diagnostics';
import type { Range } from 'brighterscript';
import type { SGTag } from 'brighterscript/dist/parser/SGTypes';


export class XMLTag {
    constructor(xmlTag: SGTag, file: File, isTopTag: boolean) {
        if (!xmlTag) {
            addXMLTagErrorCorruptXMLElement(file, '');
        }
        this.file = file;
        this.isTopTag = isTopTag;
        this.bindings = this.getBindings(xmlTag);
    }

    public file: File;
    public bindings: Binding[];
    public hasBindings: boolean;
    public startPosition: number;
    public endPosition: number;
    public line: number;
    public column: number;
    public id: string;
    public text: string;
    public isTopTag: boolean;

    public getBindings(xmlElement: SGTag): Binding[] {
        // eslint-disable-next-line prefer-regex-literals
        const staticRegex = new RegExp('^{(\\{\\:|\\{\\=)+(.*)(\\})+\\}$', 'i');
        // eslint-disable-next-line prefer-regex-literals
        const regex = new RegExp('^\\{([\\(\\{\\[])+(.*)([\\}\\)\\]])+\\}$', 'i');

        this.id = xmlElement.id;
        const bindings = [];

        for (const attribute of xmlElement.attributes) {
            let key = attribute.key.text;
            if (key.toLowerCase() !== 'id') {
                let value = attribute.value.text;
                let matches = staticRegex.exec(value);
                matches = matches || regex.exec(value);
                const colRegex = new RegExp('^((?: *|\\t*)' + attribute + '(?: *|\\t*)=(?: *|\\t*)*(?:"|\'))', 'gim');
                let col = attribute.value.range.start.character;
                const bindingText = matches && matches.length > 2 ? matches[2] : null;
                const bindingStartType = matches && matches.length > 1 ? matches[1] : null;
                const bindingEndType = matches && matches.length > 3 ? matches[3] : null;
                col += bindingStartType ? bindingStartType.length + 1 : 0;
                let mode = this.getBindingMode(bindingStartType, bindingEndType);

                if (bindingText) {
                    if (mode === BindingType.invalid && bindingStartType) {
                        addXMLTagErrorCouldMissingEndBrackets(this.file, value, attribute.value.range);
                        continue;
                    }
                    const binding = new Binding(this.file);
                    binding.nodeId = this.isTopTag ? 'top' : this.id;
                    binding.nodeField = this.isTopTag ? this.id : key;
                    binding.isTopBinding = this.isTopTag;
                    binding.attribute = attribute;
                    if (binding.properties.type === BindingType.invalid) {
                        binding.properties.type = mode;
                    }
                    binding.range = attribute.range;

                    if (mode === BindingType.code) {
                        binding.rawValueText = value.substring(3, value.length - 2);
                    } else if (mode === BindingType.twoWay) {
                        //is it a bindng and sub binding (e.g. [{vmField}|vmFunc()])
                        let parts = /(.*)\| *(.*)/.exec(bindingText);
                        if (parts && parts.length > 2) {
                            binding.createBinding(true);
                            binding.createBinding(false);
                            this.parseSubBindingText(parts[1], binding.getBinding);
                            this.parseSubBindingText(parts[2], binding.setBinding);
                            binding.rawValueText = value;
                        } else {
                            this.parseBindingText(bindingText, binding, value);
                            binding.rawValueText = value;
                        }

                    } else {
                        this.parseBindingText(bindingText, binding, value);
                    }
                    binding.tagText = value;
                    binding.validate();
                    bindings.push(binding);

                    if (!binding.isValid) {
                        addXMLTagErrorCouldNotParseBinding(this.file, value, binding.errorMessage, binding.range);
                    }
                } else {
                    // eslint-disable-next-line prefer-regex-literals
                    const startRegex = new RegExp('^\\{([\\(\\{\\[])', 'i');

                    if (startRegex.test(value)) {
                        addXMLTagErrorCouldMissingEndBrackets(this.file, value, attribute.range);
                    }

                }
            }
        }

        for (let b of bindings) {
            if (this.isTopTag) {
                (xmlElement.getAttribute('value') as any).value.text = '';
            } else {
                xmlElement.setAttribute(b.nodeField.toLowerCase(), undefined);
            }
        }
        this.hasBindings = bindings.length > 0;
        return bindings;
    }

    public parseSubBindingText(text: string, binding: Binding) {
        const parts = text.split(';');
        for (let i = 0; i < parts.length; i++) {
            this.parseBindingPart(i, parts[i].replace(/\s/g, ''), binding, text, binding.range);
        }
        binding.rawValueText = text;
    }
    public parseBindingText(text: string, binding: Binding, tagText: string) {
        const parts = text.split(';');
        for (let i = 0; i < parts.length; i++) {
            this.parseBindingPart(i, parts[i].replace(/\s/g, ''), binding, tagText, binding.range);
        }
        binding.rawValueText = tagText;
    }

    public parseBindingPart(index: number, partText: string, binding: Binding, tagText: string, range: Range) {
        if (index === 0) {
            binding.parseObserveField(partText);
        } else if (partText.toLowerCase().includes('transform=')) {
            //transform function
            let transformFunction = partText.substring(10);
            if (transformFunction.trim()) {
                binding.properties.transformFunction = transformFunction;
            } else {
                addXMLTagErrorCouldNotParseBindingTransformFunctionForField(this.file, partText, tagText, range);
            }
        } else if (partText.toLowerCase().trim() === 'fireonset') {
            binding.properties.fireOnSet = true;
        } else if (partText.toLowerCase().trim() === 'once') {
            binding.properties.isFiringOnce = true;
        } else {
            addXMLTagErrorCouldNotParseBindingSettings(this.file, partText, binding);

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
