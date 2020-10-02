import { expect } from 'chai';
import * as chai from 'chai';
import * as _ from 'lodash';

import { BrsFile, Program } from 'brighterscript';

import ImportProcessor from './ImportProcessor';

const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

let importProcessor: ImportProcessor;

describe('build time imports', function() {
  beforeEach(async () => {
  });

  it('adds build time imports', function() {
    let program = new Program({});
    let file = new BrsFile('/tmp/t.bs', 'source/t.bs', program);
    file.parse(`import "pkg:/source/mixins/FocusMixin.bs"
import "build:/IAuthProvider"

function Init() as void
    m.log.I("Init")
    m.screenStack = createObject("roArray", 0, true)
    m.top.topScreen = invalid
end function`);
    importProcessor.processDynamicImports(file, program);
    expect(file.getDiagnostics).to.be.empty;
  });

  it('throws error when a build time import is encountered, with no matching key in the config', function() {

    let program = new Program({});
    let file = new BrsFile('/tmp/t.bs', 'source/t.bs', program);
    file.parse(`import "pkg:/source/mixins/FocusMixin.bs"
import "build:/IAuthProvider"

function Init() as void
    m.log.I("Init")
    m.screenStack = createObject("roArray", 0, true)
    m.top.topScreen = invalid
end function
import "pkg:/source/b2.bs"
import "pkg:/source/b3.bs"
`);
    importProcessor.processDynamicImports(file, program);
    expect(() => importProcessor.processDynamicImports(file, program)).to.throw(Error);
  });

});
