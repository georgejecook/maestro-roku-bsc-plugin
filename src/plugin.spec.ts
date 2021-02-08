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

    beforeEach(() => {
        plugin = new MaestroPlugin();
        options = {
            rootDir: _rootDir,
            stagingFolderPath: _stagingFolderPath
        };
        fsExtra.ensureDirSync(_stagingFolderPath);
        fsExtra.ensureDirSync(_rootDir);
        fsExtra.ensureDirSync(tmpPath);
        builder = new ProgramBuilder();
        builder.options = util.normalizeAndResolveConfig(options);
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


        it('warns when field bindings do not match class', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                public text
                function onChangeVisible(value)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            visible='{(onChangeVisible)}'
            id='topBanner'
            width='1920'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.not.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.not.be.empty;

            let a = getContents('components/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/components/comp.brs" />
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Poster id="topBanner" width="1920" height="174" uri="" translation="[0,0]" />
            </children>
            </component>
            `);
            expect(a).to.equal(b);

        });

        it.only('warns when field bindings are not public', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                private width
                private function onChangeVisible(value)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            visible='{(onChangeVisible(value))}'
            id='topBanner'
            width='{{width}}'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.not.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.not.be.empty;

            let a = getContents('components/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/components/comp.brs" />
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Poster id="topBanner" width="1920" height="174" uri="" translation="[0,0]" />
            </children>
            </component>
            `);
            expect(a).to.equal(b);

        });

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
            `);
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
            `);
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
            `);
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
            `);
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
            `);
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
            `);
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
            `);
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
            `);
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

        describe('extra validation', () => {

            it('gives diagostic for unknown field', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @strict
                    class VM
                        public fieldA
                        function doStuff()
                        m.fieldA = "ok"
                        m.fieldB = "notOk"
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.not.be.empty;
            });

            it('gives diagnostic for  unknown function', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @strict
                    class VM
                        function doStuff()
                        m.notThere()
                        end function

                        function other()
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.not.be.empty;
            });
            it('does not gives diagostic for field in superclass', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        public isThere
                    end class
                `);

                program.addOrReplaceFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.isthere = true
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });

            it('does not gives diagnostic for function in superclass', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        function there()
                        end function
                    end class
                `);

                program.addOrReplaceFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.there()
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });

        });
        describe('vms', () => {

            it('replaces m.value = with m.setField', async () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @useSetField
                    class VM

                        public fieldA
                        public fieldB
                        private fieldC
                        function doStuff()
                            m.setField("fieldA", "val1")
                            m.fieldA = "val1"
                            m.fieldB = {this:"val2"}
                            m.fieldC = {this:"val1"}
                            m.notKnown = true
                            m.fieldA = something.getVAlues({this:"val1"}, "sdfd")
                        end function
                   end class
                `);
                await builder.transpile();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                let a = getContents('source/VM.brs');
                let b = trimLeading(`function __VM_builder()
                instance = {}
                instance.new = sub()
                m.fieldA = invalid
                m.fieldB = invalid
                m.fieldC = invalid
                m.__className = "VM"
                end sub
                instance.doStuff = function()
                m.setField("fieldA", "val1")
                m.setField("fieldA", "val1")
                m.setField("fieldB", {
                this: "val2"
                })
                m.fieldC = {
                this: "val1"
                }
                m.notKnown = true
                m.setField("fieldA", something.getVAlues({
                this: "val1"
                }, "sdfd"))
                end function
                return instance
                end function
                function VM()
                instance = __VM_builder()
                instance.new()
                return instance
                end function`);
                expect(a).to.equal(b);
            });

            it('replaces m.value = with m.setField, when field is defined in super class', async () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @useSetField
                    class VM

                        public fieldA
                        public fieldB
                        private fieldC
                        function doStuff()
                        end function
                   end class
                    class ChildVM extends VM
                        function doStuff()
                            m.setField("fieldA", "val1")
                            m.fieldA = "val1"
                            m.fieldB = {this:"val2"}
                            m.fieldC = {this:"val1"}
                            m.notKnown = true
                            m.fieldA = something.getVAlues({this:"val1"}, "sdfd")
                        end function
                   end class
                `);
                await builder.transpile();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                let a = getContents('source/VM.brs');
                let b = trimLeading(`function __VM_builder()
                instance = {}
                instance.new = sub()
                m.fieldA = invalid
                m.fieldB = invalid
                m.fieldC = invalid
                m.__className = "VM"
                end sub
                instance.doStuff = function()
                end function
                return instance
                end function
                function VM()
                instance = __VM_builder()
                instance.new()
                return instance
                end function
                function __ChildVM_builder()
                instance = __VM_builder()
                instance.super0_new = instance.new
                instance.new = sub()
                m.super0_new()
                m.__className = "ChildVM"
                end sub
                instance.doStuff = function()
                m.setField("fieldA", "val1")
                m.setField("fieldA", "val1")
                m.setField("fieldB", {
                this: "val2"
                })
                m.fieldC = {
                this: "val1"
                }
                m.notKnown = true
                m.setField("fieldA", something.getVAlues({
                this: "val1"
                }, "sdfd"))
                end function
                return instance
                end function
                function ChildVM()
                instance = __ChildVM_builder()
                instance.new()
                return instance
                end function`);
                expect(a).to.equal(b);
            });
        });
        describe('ioc', () => {

            it('wires up fields with inject annocations', async () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @useSetField
                    class VM
                        @inject("EntitleMents")
                        public fieldA
                        @injectClass("mc.collections.FieldMapper")
                        public fieldB
                   end class
                `);
                await builder.transpile();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                let a = getContents('source/VM.brs');
                let b = trimLeading(`function __VM_builder()
                instance = {}
                instance.new = sub()
                m.fieldA = mioc_getInstance("EntitleMents")
                m.fieldB = mioc_getClassInstance("mc.collections.FieldMapper")
                m.__className = "VM"
                end sub
                return instance
                end function
                function VM()
                instance = __VM_builder()
                instance.new()
                return instance
                end function`);
                expect(a).to.equal(b);
            });
        });
        describe.skip('run a local project', () => {
            it('sanity checks on parsing - only run this outside of ci', () => {
                let programBuilder = new ProgramBuilder();
                let config = {
                    'rootDir': '/home/george/hope/applicaster/zapp-roku-app/src',
                    'stagingFolderPath': '/home/george/hope/applicaster/zapp-roku-app/build',
                    'retainStagingFolder': true,
                    'createPackage': false,
                    'autoImportComponentScript': true,
                    'files': [
                        'manifest',
                        'source/**/*.*',
                        'components/**/*.*',
                        'images/**/*.*',
                        {
                            'src': '../external/plugins-src/**/*.*',
                            'dest': ''
                        },
                        {
                            'src': '../external/plugins-core-src/**/*.*',
                            'dest': ''
                        },
                        {
                            'src': '../external/private-emmys-src/**/*.*',
                            'dest': ''
                        },
                        {
                            'src': '../external/private-oc-src/**/*.*',
                            'dest': ''
                        },
                        {
                            'src': '!../external/plugins-src/**/*.spec.bs',
                            'dest': ''
                        },
                        {
                            'src': '!../external/plugins-core-src/**/*.spec.*',
                            'dest': ''
                        },
                        {
                            'src': '!../external/private-emmys-src/**/*.spec.*',
                            'dest': ''
                        },
                        {
                            'src': '!../external/private-oc-src/**/*.spec.*',
                            'dest': ''
                        },
                        '!**/*.spec.bs'
                    ],
                    'diagnosticFilters': [
                        {
                            'src': '**/roku_modules/**/*.*',
                            'codes': [
                                1107,
                                1009,
                                1001,
                                1067
                            ]
                        },
                        {
                            'src': 'components/maestro/generated/**/*.*',
                            'codes': [
                                1001
                            ]
                        },
                        1013,
                        {
                            'src': '../external/plugins-src/components/YouboraAnalytics/*.*'
                        },
                        {
                            'src': '../external/plugins-src/components/segment_analytics/*.*'
                        },
                        {
                            'src': '../external/plugins-src/source/segment_analytics/SegmentAnalytics.brs'
                        },
                        {
                            'src': '**/RALETrackerTask.*'
                        }
                    ],
                    'plugins': [
                        '/home/george/hope/open-source/roku-log/roku-log-bsc-plugin/dist/plugin.js',
                        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js'
                    ],
                    'rooibos': {
                        'isRecordingCodeCoverage': false,
                        'testsFilePattern': null
                    },
                    'maestro': {
                        'buildTimeImports': {
                            'IAuthProvider': [
                                'pkg:/source/inplayer_auth_plugin_roku/InPlayerAuthPlugin.bs'
                            ],
                            'IEntitlementsProvider': [
                                'pkg:/source/inplayer_entitlements_plugin/InPlayerEntitlementsPlugin.bs'
                            ],
                            'IBookmarksProvider': [],
                            'IPlayerAnalytics': [],
                            'IAnalytics': [
                                'pkg:/source/google_analytics_roku/GoogleAnalyticsPlugin.bs'
                            ]
                        }
                    },
                    'rokuLog': {
                        'strip': false,
                        'insertPkgPath': true
                    },
                    'sourceMap': true
                };
                programBuilder.run(
                    config
                //     {
                //     project: '/home/george/hope/applicaster/zapp-roku-app/bsconfig-test.json'
                //     // project: '/home/george/hope/open-source/maestro/swerve-app/bsconfig-test.json'
                // }
                ).catch(e => {
                    console.error(e);
                });
            });
        });

    });
});

function getContents(filename: string) {
    return trimLeading(fsExtra.readFileSync(s`${_stagingFolderPath}/${filename}`).toString());
}
