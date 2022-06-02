import { expect } from 'chai';
import type { BeforeFileTranspileEvent } from 'brighterscript';
import { AstEditor, BrsFile, Program } from 'brighterscript';
import ImportProcessor from './ImportProcessor';

describe('build time imports', () => {
    let program: Program;
    let editor: AstEditor;
    let event: BeforeFileTranspileEvent<BrsFile>;
    let importProcessor: ImportProcessor;
    beforeEach(() => {
        program = new Program({});
        editor = new AstEditor();
        importProcessor = new ImportProcessor({
            'buildTimeImports': {
                'IAuthProvider': ['pkg:/source/AuthManager.bs']
            }
        });
        event = {
            program: program,
            editor: editor,
            file: new BrsFile('/tmp/t.bs', 'source/t.bs', program),
            outputPath: 'somewhere'
        };
    });

    it('adds build time imports', () => {
        program.setFile('source/AuthManager.bs', `
            class someClass
            end class
        `);
        program.validate();

        event.file.parse(`
            import "pkg:/source/mixins/FocusMixin.bs"
            import "build:/IAuthProvider"

            function Init() as void
                m.log.I("Init")
                m.screenStack = createObject("roArray", 0, true)
                m.top.topScreen = invalid
            end function
        `);
        importProcessor.processDynamicImports(event.file, event.program);
        expect(event.file.getDiagnostics()).to.be.empty;
        //TODO reenable once BSC supports dynamic imports like `build:/`
        // editor.undoAll();
        //the AST should remain unchanged
        // expect((event.file.ast.statements[1] as ImportStatement).filePath).to.eql('build:/IAuthProvider');
    });

    it('empty build time imports', () => {
        program.setFile('source/AuthManager.bs', `
            class someClass
            end class
        `);
        program.validate();

        event.file.parse(`
            import "pkg:/source/mixins/FocusMixin.bs"
            import "build:/IAuthProvider"

            function Init() as void
                m.log.I("Init")
                m.screenStack = createObject("roArray", 0, true)
                m.top.topScreen = invalid
            end function
        `);
        importProcessor.processDynamicImports(event.file, event.program);
        expect(event.file.getDiagnostics()).to.be.empty;

        //TODO reenable once BSC supports dynamic imports like `build:/`
        // editor.undoAll();
        //the AST should remain unchanged
        // expect((event.file.ast.statements[1] as ImportStatement).filePath).to.eql('build:/IAuthProvider');
    });

    it('does not add diagnostics for empty build time imports, and parses file correctly', () => {
        importProcessor = new ImportProcessor({
            'buildTimeImports': {
                'IAuthProvider': []
            }
        });

        event.file.parse(`
            import "pkg:/source/mixins/FocusMixin.bs"
            import "build:/IAuthProvider"

            function Init() as void
                m.log.I("Init")
                m.screenStack = createObject("roArray", 0, true)
                m.top.topScreen = invalid
            end function
        `);
        importProcessor.processDynamicImports(event.file, event.program);

        expect(event.file.getDiagnostics()).to.have.length(0);

        //TODO reenable once BSC supports dynamic imports like `build:/`
        // editor.undoAll();
        //the AST should remain unchanged
        // expect((event.file.ast.statements[1] as ImportStatement).filePath).to.eql('build:/IAuthProvider');
    });
});
