import { expect } from 'chai';
import * as chai from 'chai';
import * as path from 'path';

import { File } from '../fileProcessing/File';
import { ProjectFileMap } from '../fileProcessing/ProjectFileMap';
import Binding from './Binding';
import { BindingProcessor } from './BindingProcessor';
import { BindingType } from './BindingType';
import { XMLTag } from './XMLTag';

const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

let config = require('../../test/testProcessorConfig.json');
let fileMap: ProjectFileMap;
let importFilesPath: string = path.join('components', 'screens', 'imports');
let projectPath: string = path.join(path.resolve(config.outputPath), importFilesPath);
let bindingProcessor: BindingProcessor;
let file = createFile('file.brs', '.brs');

describe('XMLElement', function() {
  beforeEach(async () => {
  });

  describe('constructor', function() {
    it('throws error for null element', function() {
      expect(() => new XMLTag(null, null, file)).to.throw(Error);
      expect(file.diagnostics).to.not.be.empty;
    });

    it('throws error for empty text', function() {
      expect(() => new XMLTag(null, null, file)).to.throw(Error);
      expect(file.diagnostics).to.not.be.empty;
    });
  });

  describe('Valid bindings', function() {
    it('identifies simple one way binding', function() {
      const element = {
        name: 'Label',
        attr: {
          id: 'titleLabel',
          text: '{{vm.titleText}}'
        },
        val: '',
        children: [],
        firstChild: null,
        lastChild: null,
        line: 24,
        column: 37,
        position: 697,
        startTagPosition: 626,
        endTagPosition: 697
      };
      const tagText = `Label
            id="titleLabel"
            text="{{vm.titleText}}" />`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(1);
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('text');
      expect(binding.nodeId).to.equal('titleLabel');
      expect(binding.observerField).to.equal('titleText');
      expect(binding.properties.type).to.equal(BindingType.oneWaySource);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect().to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });

    it('identifies simple one way binding on top field', function() {
      const element = {
        name: 'Field',
        attr: {
          id: 'titleLabel',
          type: 'string',
          value: '{{vm.titleText}}'
        },
        val: '',
        children: [],
        firstChild: null,
        lastChild: null,
        line: 24,
        column: 37,
        position: 697,
        startTagPosition: 626,
        endTagPosition: 697
      };
      const tagText = `Field
            id="titleLabel"
            type="string"
            value="{{vm.titleText}}" />`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(1);
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('titleLabel');
      expect(binding.nodeId).to.equal('top');
      expect(binding.observerField).to.equal('titleText');
      expect(binding.isTopBinding).to.be.true;
      expect(binding.properties.type).to.equal(BindingType.oneWaySource);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });

    it('identifies one way target binding - alternate syntax', function() {
      const element = {
        name: 'Label',
        attr: {
          id: 'titleLabel',
          text: '{(vm.titleText)}'
        },
        val: '',
        children: [],
        firstChild: null,
        lastChild: null,
        line: 24,
        column: 37,
        position: 697,
        startTagPosition: 626,
        endTagPosition: 697
      };
      const tagText = `Label
            id="titleLabel"
            text="{(vm.titleText)}" />`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(1);
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('text');
      expect(binding.nodeId).to.equal('titleLabel');
      expect(binding.observerField).to.equal('titleText');
      expect(binding.properties.type).to.equal(BindingType.oneWayTarget);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });

    it('identifies two way binding - alternate syntax', function() {
      const element = {
        name: 'Label',
        attr: {
          id: 'titleLabel',
          text: '{[vm.titleText]}'
        },
        val: '',
        children: [],
        firstChild: null,
        lastChild: null,
        line: 24,
        column: 37,
        position: 697,
        startTagPosition: 626,
        endTagPosition: 697
      };
      const tagText = `Label
            id="titleLabel"
            text="{[vm.titleText]}}" />`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(1);
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('text');
      expect(binding.nodeId).to.equal('titleLabel');
      expect(binding.observerField).to.equal('titleText');
      expect(binding.properties.type).to.equal(BindingType.twoWay);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });

    it('identifies simple one way binding to function', function() {
      const element = {
        name: 'Label',
        attr: {
          id: 'titleLabel',
          text: '{(vm.titleText())}'
        },
        val: '',
        children: [],
        firstChild: null,
        lastChild: null,
        line: 24,
        column: 37,
        position: 697,
        startTagPosition: 626,
        endTagPosition: 697
      };
      const tagText = `Label
            id="titleLabel"
            text="{(vm.titleText())}" />`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(1);
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('text');
      expect(binding.nodeId).to.equal('titleLabel');
      expect(binding.observerField).to.equal('titleText');
      expect(binding.properties.type).to.equal(BindingType.oneWayTarget);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });

    it('identifies two way binding', function() {
      const element = {
        name: 'InputBox',
        attr: {
          id: 'nameInput',
          text: '{{vm.name, mode=TwoWay}}'
        },
        val: '',
        children: [],
        firstChild: null,
        lastChild: null,
        line: 35,
        column: 45,
        position: 970,
        startTagPosition: 889,
        endTagPosition: 970
      };
      const tagText = `InputBox
            id="nameInput"
            text="{{vm.name, mode=TwoWay}}" />`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(1);
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('text');
      expect(binding.nodeId).to.equal('nameInput');
      expect(binding.observerField).to.equal('name');
      expect(binding.properties.type).to.equal(BindingType.twoWay);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });

    it('identifies multiple bindings', function() {
      const element = {
        name: 'RowList',
        attr: {
          id: 'rowList',
          visible: '{{vm.isGroupVisible, transform=OM_transform_invertBoolean}}',
          clicked: '{(vm.onItemClicked())}',
          jumpToIndex: '{{vm.jumpToIndex, mode=oneWayTarget}}',
          focusedIndex: '{{vm.focusedIndex, mode=oneWaySource}}',
          selectedIndex: '{{vm.selectedIndex, mode=twoWay, fireOnSet=false}}'
        },
        val: '',
        children: [],
        firstChild: null,
        lastChild: null,
        line: 57,
        column: 67,
        position: 1831,
        startTagPosition: 1466,
        endTagPosition: 1831
      };
      const tagText = `RowList
                id="rowList"
                visible="{{vm.isGroupVisible, transform=OM_transform_invertBoolean}}"
                clicked="{(vm.onItemClicked())}"
                jumpToIndex="{{vm.jumpToIndex, mode=oneWay}}"
                focusedIndex="{{vm.focusedIndex, mode=oneWaySource}}"
                selectedIndex="{{vm.selectedIndex, mode=twoWay, fireOnSet=false}}" />`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(5);

      //visible
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('visible');
      expect(binding.nodeId).to.equal('rowList');
      expect(binding.observerField).to.equal('isGroupVisible');
      expect(binding.properties.type).to.equal(BindingType.oneWaySource);
      expect(binding.properties.transformFunction).to.equal('OM_transform_invertBoolean');
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;

      //clicked
      binding = tag.bindings[1];
      expect(binding.nodeField).to.equal('clicked');
      expect(binding.nodeId).to.equal('rowList');
      expect(binding.observerField).to.equal('onItemClicked');
      expect(binding.properties.type).to.equal(BindingType.oneWayTarget);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;

      //jumpToIndex
      binding = tag.bindings[2];
      expect(binding.nodeField).to.equal('jumpToIndex');
      expect(binding.nodeId).to.equal('rowList');
      expect(binding.observerField).to.equal('jumpToIndex');
      expect(binding.properties.type).to.equal(BindingType.oneWayTarget);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;

      //focusedIndex
      binding = tag.bindings[3];
      expect(binding.nodeField).to.equal('focusedIndex');
      expect(binding.nodeId).to.equal('rowList');
      expect(binding.observerField).to.equal('focusedIndex');
      expect(binding.properties.type).to.equal(BindingType.oneWaySource);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;

      //selectedIndex
      binding = tag.bindings[4];
      expect(binding.nodeField).to.equal('selectedIndex');
      expect(binding.nodeId).to.equal('rowList');
      expect(binding.observerField).to.equal('selectedIndex');
      expect(binding.properties.type).to.equal(BindingType.twoWay);
      expect(binding.properties.transformFunction).to.be.null;
      expect(binding.properties.fireOnSet).to.be.false;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });

    it('identifies transform function', function() {
      const element = {
        name: 'Group',
        attr: {
          id: 'innerGroup',
          visible: '{{vm.isGroupVisible, transform=OM_transform_invertBoolean}}'
        },
        val: '\n\n            \n            \n\n                \n            \n            ',
        children: [],
        firstChild: {
          text: '\n\n            '
        },
        lastChild: {
          text: '\n            '
        },
        line: 43,
        column: 81,
        position: 1223,
        startTagPosition: 1120,
        endTagPosition: 1223
      };
      const tagText = `Group id="innerGroup"
            visible="{{vm.isGroupVisible, transform=OM_transform_invertBoolean}}">`;
      const tag = new XMLTag(element, tagText, file);
      expect(tag.bindings).to.have.lengthOf(1);
      let binding: Binding = tag.bindings[0];
      expect(binding.nodeField).to.equal('visible');
      expect(binding.nodeId).to.equal('innerGroup');
      expect(binding.observerField).to.equal('isGroupVisible');
      expect(binding.properties.type).to.equal(BindingType.oneWaySource);
      expect(binding.properties.transformFunction).to.equal('OM_transform_invertBoolean');
      expect(binding.properties.fireOnSet).to.be.true;
      // expect(getAllFeedback()).to.be.empty;
      binding.validate();
      expect(binding.isValid).to.be.true;
    });
  });
});

function createFile(path, extension) {
  return new File(`${config.outputPath}.${extension}`);
}
