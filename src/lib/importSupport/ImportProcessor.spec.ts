import { expect } from 'chai';

import { BrsFile, Program } from 'brighterscript';
import ImportProcessor from './ImportProcessor';

let importProcessor: ImportProcessor;

describe('build time imports', () => {
    beforeEach(() => {
        importProcessor = new ImportProcessor({
            'buildTimeImports': {
                'IAuthProvider': ['pkg:/source/AuthManager.bs']
            }
        });
    });

    it('adds build time imports', () => {
        let program = new Program({});
        program.setFile('source/AuthManager.bs', `
            class someClass
            end class
        `);
        program.validate();

        let file = new BrsFile({ srcPath: '/tmp/t.bs', destPath: 'source/t.bs', program: program });
        file.parse(`
            import "pkg:/source/mixins/FocusMixin.bs"
            import "build:/IAuthProvider"

            function Init() as void
                m.log.I("Init")
                m.screenStack = createObject("roArray", 0, true)
                m.top.topScreen = invalid
            end function
        `);
        importProcessor.processDynamicImports(file, program);
        expect(file.getDiagnostics()).to.be.empty;
    });

    it('empty build time imports', () => {
        let program = new Program({});
        program.setFile('source/AuthManager.bs', `
            class someClass
            end class
        `);
        program.validate();

        let file = new BrsFile({ srcPath: '/tmp/t.bs', destPath: 'source/t.bs', program: program });
        file.parse(`
            import "pkg:/source/mixins/FocusMixin.bs"
            import "build:/IAuthProvider"

            function Init() as void
                m.log.I("Init")
                m.screenStack = createObject("roArray", 0, true)
                m.top.topScreen = invalid
            end function
        `);
        importProcessor.processDynamicImports(file, program);
        expect(file.getDiagnostics()).to.be.empty;
    });

    it('does not add diagnostics for empty build time imports, and parses file correctly', () => {
        importProcessor = new ImportProcessor({
            'buildTimeImports': {
                'IAuthProvider': []
            }
        });

        let program = new Program({});
        let file = new BrsFile({ srcPath: '/tmp/t.bs', destPath: 'source/t.bs', program: program });
        file.parse(`
            import "pkg:/source/mixins/FocusMixin.bs"
            import "build:/IAuthProvider"

            function Init() as void
                m.log.I("Init")
                m.screenStack = createObject("roArray", 0, true)
                m.top.topScreen = invalid
            end function
        `);
        importProcessor.processDynamicImports(file, program);

        expect(file.getDiagnostics()).to.have.length(0);
    });

});
