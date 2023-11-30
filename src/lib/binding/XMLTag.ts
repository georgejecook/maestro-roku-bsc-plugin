import type { MaestroFile } from '../files/MaestroFile';
import Binding from './Binding';
import { BindingSendMode, BindingType } from './BindingType';
import {
    addXMLTagErrorCorruptXMLElement,
    addXMLTagErrorCouldMissingEndBrackets,
    addXMLTagErrorCouldNotParseBinding,
    addXMLTagErrorCouldNotParseBindingTransformFunctionForField,
    addXMLTagErrorCouldNotParseIsFiringOnceForField as addXMLTagErrorCouldNotParseBindingSettings
} from '../utils/Diagnostics';
import type { Range } from 'brighterscript';
import type { SGElement } from 'brighterscript/dist/parser/SGTypes';

export class XMLTag {
    constructor(xmlTag: SGElement, file: MaestroFile, isTopTag: boolean) {
        if (!xmlTag) {
            addXMLTagErrorCorruptXMLElement(file, '');
        }
        this.file = file;
        this.isTopTag = isTopTag;
        this.bindings = this.getBindings(xmlTag);
    }

    public file: MaestroFile;
    public bindings: Binding[];
    public hasBindings: boolean;
    public startPosition: number;
    public endPosition: number;
    public line: number;
    public column: number;
    public id: string;
    public text: string;
    public isTopTag: boolean;

    public getBindings(xmlElement: SGElement): Binding[] {
        // eslint-disable-next-line prefer-regex-literals
        const staticRegex = new RegExp('^{(\\{\\:|\\{\\=)+(.*)(\\})+\\}$', 'i');
        // eslint-disable-next-line prefer-regex-literals
        const regex = new RegExp('^\\{([\\(\\{\\[])+(.*)([\\}\\)\\]])+\\}$', 'i');

        this.id = xmlElement.id;
        const bindings = [];

        for (const attribute of xmlElement.attributes) {
            let key = attribute.key;
            if (key.toLowerCase() !== 'id') {
                let value = attribute.value;
                let matches = staticRegex.exec(value);
                matches = matches || regex.exec(value);
                const bindingText = matches && matches.length > 2 ? matches[2] : null;
                const bindingStartType = matches && matches.length > 1 ? matches[1] : null;
                const bindingEndType = matches && matches.length > 3 ? matches[3] : null;
                let mode = this.getBindingMode(bindingStartType, bindingEndType);

                if (bindingText) {
                    if (mode === BindingType.invalid && bindingStartType) {
                        addXMLTagErrorCouldMissingEndBrackets(this.file, value, attribute.range);
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
                        //is it a Binding and sub binding (e.g. [{vmField}|vmFunc()])
                        let parts = /(.*)\| *(.*)/.exec(bindingText);
                        if (parts && parts.length > 2) {
                            binding.createBinding(true);
                            binding.createBinding(false);
                            this.parseSubBindingText(parts[1], binding.getBinding, binding.properties.type);
                            this.parseSubBindingText(parts[2], binding.setBinding, binding.properties.type);
                            if (!binding.getBinding.isValid) {
                                binding.isValid = false;
                                binding.errorMessage = binding.getBinding.errorMessage;
                            } else if (!binding.setBinding.isValid) {
                                binding.isValid = false;
                                binding.errorMessage = binding.setBinding.errorMessage;
                            }
                            binding.rawValueText = value;
                        } else {
                            this.parseBindingText(bindingText, binding, value, binding.properties.type);
                            binding.rawValueText = value;
                        }

                    } else {
                        this.parseBindingText(bindingText, binding, value, binding.properties.type);
                    }
                    binding.tagText = value;
                    if (!binding.errorMessage) {
                        binding.validate();
                    }
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                xmlElement.setAttributeValue(b.nodeField.toLowerCase(), undefined);
            }
        }
        this.hasBindings = bindings.length > 0;
        return bindings;
    }

    public parseSubBindingText(text: string, binding: Binding, bindingType: BindingType) {
        const parts = text.split(':');
        for (let i = 0; i < parts.length; i++) {
            this.parseBindingPart(i, parts[i].replace(/\s/g, ''), binding, text, binding.range, bindingType);
        }
        binding.rawValueText = text;
    }

    public parseBindingText(text: string, binding: Binding, tagText: string, bindingType: BindingType) {
        const parts = text.split(':');
        for (let i = 0; i < parts.length; i++) {
            this.parseBindingPart(i, parts[i].replace(/\s/g, ''), binding, tagText, binding.range, bindingType);
        }
        binding.rawValueText = tagText;
    }

    public parseBindingPart(index: number, partText: string, binding: Binding, tagText: string, range: Range, bindingType: BindingType) {
        if (index === 0) {
            binding.parseObserveField(partText);
            if (bindingType === BindingType.oneWayTarget && binding.properties.sendMode === BindingSendMode.badlyFormed) {
                binding.isValid = false;
                binding.errorMessage = `Binding observer ${tagText} is configured as a function binding; but with an incorrect signature. Either use a field as the target of this binding, or indicate the function call signature: e.g. (), (value), (node), or (value, node).`;
            }
        } else if (partText.toLowerCase().includes('transform=')) {
            //transform function
            let transformFunction = partText.substring(10);
            if (transformFunction.trim()) {
                binding.properties.transformFunction = transformFunction;
            } else {
                addXMLTagErrorCouldNotParseBindingTransformFunctionForField(this.file, partText, tagText, range);
            }
        } else if (partText.toLowerCase().trim() === 'eager') {
            binding.properties.fireTiming = 'eager';
        } else if (partText.toLowerCase().trim() === 'lazy') {
            binding.properties.fireTiming = 'lazy';
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
