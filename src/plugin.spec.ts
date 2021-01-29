/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import type { BrsFile } from 'brighterscript';
import { DiagnosticSeverity, Program, ProgramBuilder, util } from 'brighterscript';
import { expect } from 'chai';
import { MaestroPlugin } from './plugin';
import PluginInterface from 'brighterscript/dist/PluginInterface';
import { standardizePath as s } from './lib/Utils';
import * as fsExtra from 'fs-extra';
import * as path from 'path';

import { trimLeading } from './lib/utils/testHelpers.spec';

let tmpPath = s`${process.cwd()}/tmp`;
let _rootDir = s`${tmpPath}/rootDir`;
let _stagingFolderPath = s`${tmpPath}/staging`;

describe('MaestroPlugin', () => {
    let program: Program;
    let builder: ProgramBuilder;
    let plugin: MaestroPlugin;
    let options;

    beforeEach(async () => {
        plugin = new MaestroPlugin();
        options = {
            rootDir: _rootDir,
            stagingFolderPath: _stagingFolderPath
        };
        fsExtra.ensureDirSync(_stagingFolderPath);
        fsExtra.ensureDirSync(_rootDir);
        fsExtra.ensureDirSync(tmpPath);
        builder = new ProgramBuilder();
        builder.options = await util.normalizeAndResolveConfig(options);
        builder.program = new Program(builder.options);
        program = builder.program;
        builder.plugins = new PluginInterface([plugin], undefined);
        program.plugins = new PluginInterface([plugin], undefined);
        program.createSourceScope(); //ensure source scope is created
        plugin.beforeProgramCreate(builder);

    });
    afterEach(() => {
        fsExtra.ensureDirSync(tmpPath);
        fsExtra.emptyDirSync(tmpPath);
        builder.dispose();
        program.dispose();
    });

    describe('binding tests', () => {

        it('does not manipulate non binding xml files', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView">
    <interface>
    </interface>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            let a = getContents('components/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
        it('does removes vm tags from files files', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            let a = getContents('components/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
    });

    describe('general tests', () => {

        it('does not manipulate xml files that are in default ignored folders (roku_modules)', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/roku_modules/mv/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
    <interface>
    </interface>
    <children>
    <Label id="test" text="{{field}}" />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            let a = getContents('components/roku_modules/mv/comp.xml');
            //note - we still remove illegal vm attribute
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" text="{{field}}" />
            </children>
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
        it('can turnoff default default ignored folders ', async () => {
            plugin.maestroConfig = {
                excludeFilters: []
            };
            plugin.importProcessor.config = plugin.maestroConfig;

            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/roku_modules/mv/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
    <interface>
    </interface>
    <children>
    <Label id="test" text="{{field}}" />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.not.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.not.be.empty;

            let a = getContents('components/roku_modules/mv/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" />
            </children>
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
        it('does not manipulate files in specified folders ', async () => {
            plugin.maestroConfig = {
                excludeFilters: ['**/ignored/**/*.*']
            };
            plugin.importProcessor.config = plugin.maestroConfig;

            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/ignored/mv/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
    <interface>
    </interface>
    <children>
    <Label id="test" text="{{field}}" />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            let a = getContents('components/ignored/mv/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" text="{{field}}" />
            </children>
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
    });

    describe('node class tests', () => {

        it('parses a node class with no errors', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @field("string")
                    public title
                    public content

                    function new(globalNode, top)
                    end function
               end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            let a = getContents('components/maestro/generated/Comp.xml');
            let b = trimLeading(`<?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
            <interface>
            <field id="data" type="assocarray" />
            <field id="title" type="string" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children />
            </component>
            <!--//# sourceMappingURL=./Comp.xml.map -->`);
            expect(a).to.equal(b);

            a = getContents('components/maestro/generated/Comp.brs');
            b = trimLeading(`'import "pkg:/source/comp.bs"

            function init()
            m.vm = Comp(m.global, m.top)
            end function`);
            expect(a).to.equal(b);

        });

        it('parses tunnels public functions', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @field("string")
                    public title
                    public content

                    function new(globalNode, top)
                    end function

                    public function someFunction()
                    end function

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            let a = getContents('components/maestro/generated/Comp.xml');
            let b = trimLeading(`<?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
            <interface>
            <field id="data" type="assocarray" />
            <field id="title" type="string" />
            <function name="someFunction" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children />
            </component>
            <!--//# sourceMappingURL=./Comp.xml.map -->`);
            expect(a).to.equal(b);

            a = getContents('components/maestro/generated/Comp.brs');
            b = trimLeading(`'import "pkg:/source/comp.bs"

            function init()
            m.vm = Comp(m.global, m.top)
            end function

            function someFunction(dummy = invalid)
            return m.vm.someFunction()
            end function`);
            expect(a).to.equal(b);

        });

        it('hooks up public fields with observers', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    @field("string")
                    public title
                    public content

                    function new(globalNode, top)
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            let a = getContents('components/maestro/generated/Comp.xml');
            let b = trimLeading(`<?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
            <interface>
            <field id="data" type="assocarray" />
            <field id="title" type="string" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children />
            </component>
            <!--//# sourceMappingURL=./Comp.xml.map -->`);
            expect(a).to.equal(b);

            a = getContents('components/maestro/generated/Comp.brs');
            b = trimLeading(`'import "pkg:/source/comp.bs"

            function init()
            m.vm = Comp(m.global, m.top)
            m.top.observeField("title", "on_title")
            end function

            function on_title()
            m.vm.title = m.top.title
            m.vm.onTitleChange(m.vm.title)
            end function`);
            expect(a).to.equal(b);

        });
        it('gives diagnostics for missing observer function params', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    @field("string")
                    public title
                    public content

                    function new(globalNode, top)
                    end function
                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
        it('gives diagnostics for wrong observer function params', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    @field("string")
                    public title
                    public content

                    function new(globalNode, top)
                    end function

                    private function onTitleChange(too, manyParams)
                    end function

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
        it('gives diagnostics for wrong constructor function params', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    @field("string")
                    public title
                    public content

                    function new()
                    end function
                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
        it('gives diagnostics for no constructor', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    @field("string")
                    public title
                    public content

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
    });
    describe('reflection', () => {

        it('adds __classname to all classes in a project', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @field("string")
                    public title
                    public content

                    function new(globalNode, top)
                    end function
               end class
            `);
            program.addOrReplaceFile('source/myClass.bs', `
                class myClass
                    public title
                end class
                namespace myNamespace
                        class myNamespacedClass
                            public title
                        end class
                end namespace
            `);
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            let classFile = program.getFileByPkgPath<BrsFile>('source/myClass.bs');
            let cs = classFile.parser.references.classStatements[0];
            expect(cs.body.length === 3);
            expect(cs.fields.length === 2);
            expect(cs.memberMap['__className'].name.text === '__className');
            let a = getContents('source/myClass.brs');
            let b = trimLeading(`function __myClass_builder()
            instance = {}
            instance.new = sub()
            m.title = invalid
            m.__className = "myClass"
            end sub
            return instance
            end function
            function myClass()
            instance = __myClass_builder()
            instance.new()
            return instance
            end function
            function __myNamespace_myNamespacedClass_builder()
            instance = {}
            instance.new = sub()
            m.title = invalid
            m.__className = "myNamespace.myNamespacedClass"
            end sub
            return instance
            end function
            function myNamespace_myNamespacedClass()
            instance = __myNamespace_myNamespacedClass_builder()
            instance.new()
            return instance
            end function`);
            a = getContents('source/comp.brs');
            b = trimLeading(`function __Comp_builder()
            instance = {}
            instance.new = function(globalNode, top)
                m.title = invalid
                m.content = invalid
                m.__className = "Comp"
            end function
            return instance
        end function
        function Comp(globalNode, top)
            instance = __Comp_builder()
            instance.new(globalNode, top)
            return instance
        end function`);
            expect(a).to.equal(b);

        });
    });
});

function getContents(filename: string) {
    return trimLeading(fsExtra.readFileSync(s`${_stagingFolderPath}/${filename}`).toString());
}
