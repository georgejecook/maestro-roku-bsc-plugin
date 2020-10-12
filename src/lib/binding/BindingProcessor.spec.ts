import { expect } from 'chai';
import * as chai from 'chai';
import * as _ from 'lodash';
import * as path from 'path';

import { File } from '../files/File';
import { ProjectFileMap } from '../files/ProjectFileMap';
import { testUtil_createStubProjectFile } from '../utils/TestUtils';
import Binding from './Binding';
import { BindingProcessor } from './BindingProcessor';
import { BindingType } from './BindingType';

const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

let config = require('../../test/testProcessorConfig.json');
let fileMap: ProjectFileMap;
let importFilesPath: string = path.join('components', 'screens', 'imports');
let projectPath: string = path.join(path.resolve(config.outputPath), importFilesPath);
let bindingProcessor: BindingProcessor;

describe('BindingProcessor', function() {
  beforeEach(async () => {
    fileMap = new ProjectFileMap();
    config = _.clone(config);
    bindingProcessor = new BindingProcessor(fileMap);
  });

  describe('Initialization', function() {
    it('initializes with valid processor', function() {
      expect(bindingProcessor).to.not.be.null;
    });
  });

  describe('processFile', function() {
    it('fails for non xml class', function() {
      const file = testUtil_createStubProjectFile('source/classes/class1.bs');

      expect(() => bindingProcessor.generateCodeForXMLFile(file)).to.throw(Error);
    });

    it('parses simple class', function() {
      const file = testUtil_createStubProjectFile('components/screens/bindings/BindingTest.xml');
      file.setFileContents(file.getFileContents());
      file.saveFileContents();
      file.loadXmlContents(fileMap);
      bindingProcessor.generateCodeForXMLFile(file);

      expect(file.isDirty).to.be.true;
    });

    it('parses extended xml', function() {
      const file = testUtil_createStubProjectFile('components/screens/bindings/BindingTestExtended.xml');
      file.setFileContents(file.getFileContents());
      file.saveFileContents();
      file.loadXmlContents(fileMap);
      bindingProcessor.generateCodeForXMLFile(file);

      expect(file.isDirty).to.be.true;
    });
    it('parses code bindings xml', function() {
      const file = testUtil_createStubProjectFile('components/screens/bindings/BindingTestCode.xml');
      file.setFileContents(file.getFileContents());
      file.saveFileContents();
      file.loadXmlContents(fileMap);
      bindingProcessor.generateCodeForXMLFile(file);

      expect(file.isDirty).to.be.true;
    });

    it('parses broken xml', function() {
      const file = testUtil_createStubProjectFile('components/screens/bindings/Broken.xml');
      file.setFileContents(`
      <?xml version="1.0" encoding="UTF-8"?>
<component name="VideoPlayer" extends="BaseScreen"
\t>
\t<interface>
\t</interface>

\t<children>
\t\t<Label text="VideoPlayer" />
    <Label
      id="debugLabel"
      translation="[300.0,300.0]"/>
    <Button id="focusTrap">
\t</children>

</component>
`);
      file.saveFileContents();
      bindingProcessor.generateCodeForXMLFile(file);
      expect(file.diagnostics).to.not.be.empty;

      expect(file.isDirty).to.be.false;
    });

    it('parses top level bindings', function() {
      const file = testUtil_createStubProjectFile('components/screens/bindings/Broken.xml');
      file.setFileContents(`
      <?xml version="1.0" encoding="UTF-8"?>
<component name="VideoPlayer" extends="BaseScreen"
\t>
\t<interface>
\t\t<field id="setMe" type="string" value="{(vm.onSetMeChange)}" />
\t</interface>
</component>
`);
      file.saveFileContents();
      file.loadXmlContents(fileMap);
      bindingProcessor.generateCodeForXMLFile(file);
      expect(file.diagnostics).to.be.empty;

      expect(file.isDirty).to.be.true;
    });
  });
});
