import type { AfterProgramCreateEvent, BrsFile, BsDiagnostic, Program } from 'brighterscript';
import { DiagnosticSeverity, ProgramBuilder, util } from 'brighterscript';
import { expect } from 'chai';
import { MaestroPlugin } from './plugin';
import { standardizePath as s } from './lib/Utils';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { expectDiagnostics, expectZeroDiagnostics } from './testHelpers.spec';

function undent(strings: TemplateStringsArray | string, ...values: any[]): string {
    // Construct the full string by interleaving the strings and values
    let fullString = '';
    for (let i = 0; i < strings.length; i++) {
        fullString += strings[i] + (values[i] || '').trim();
    }

    // Split into lines, trim leading whitespace, and rejoin
    return fullString.split('\n').map(line => line.trim()).join('\n').trim();
}

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
            stagingFolderPath: _stagingFolderPath,
            autoImportComponentScript: true
        };
        options.maestro = {
            mvvm: {},
            nodeClasses: {},
            processXMLFiles: true,
            buildTimeImports: {
                'IAuthProvider': ['pkg:/source/AuthManager.bs']
            }
        };
        fsExtra.ensureDirSync(_stagingFolderPath);
        fsExtra.ensureDirSync(_rootDir);
        fsExtra.ensureDirSync(tmpPath);

        builder = new ProgramBuilder();
        builder.options = util.normalizeAndResolveConfig(options);
        builder.plugins.add(plugin);
        builder.program = builder['createProgram']();
        program = builder.program;
        program.createSourceScope(); //ensure source scope is created
        program.setFile('manifest', ``);
    });

    afterEach(() => {
        fsExtra.ensureDirSync(tmpPath);
        fsExtra.emptyDirSync(tmpPath);
        builder.dispose();
        program.dispose();
    });

    describe('binding tests', () => {
        it('gives error diagnostics when field bindings do not match class', async () => {
            plugin.isFrameworkAdded = true;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class myVM
                    function onChangeVisible(value)
                    end function
                end class
            `);
            program.setFile('components/comp.brs', ``);

            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
                    <interface>
                    </interface>
                    <children>
                        <Poster
                            id='poster'
                            visible='{(onChangeVisible)}'
                            click0='{(onChangeVisible(wrong))}'
                            click1='{(onChangeVisible(wrong, signature))}'
                            click2='{(onChangeVisible(event, value, another)}'
                            click2='{(onChangeVisible(value)}'
                            click3='{(onChangeVisible())}'
                            width='1920'
                            height='174'
                            uri=''
                            translation='[0,0]' />
                    </children>
                </component>
            `);
            program.validate();
            await builder.build();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.have.lengthOf(6);
            checkDiagnostic(diagnostics[0], 1010, 9);
            checkDiagnostic(diagnostics[1], 1010, 10);
            checkDiagnostic(diagnostics[2], 1010, 11);
            checkDiagnostic(diagnostics[3], 1010, 12);
            checkDiagnostic(diagnostics[4], 1026, 8);
            checkDiagnostic(diagnostics[5], 1025, 13);
        });

        it('does not give diagnostics for valid target bindings', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class myVM
                    public isClicked
                    function onChangeVisible(value = invalid, node = invalid)
                    end function
                end class
            `);
            program.setFile('components/comp.brs', ``);

            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
                    <interface>
                    </interface>
                     <children>
                        <Poster
                            id='poster'
                            click0='{(onChangeVisible(node))}'
                            click1='{(onChangeVisible(value,node))}'
                            click2='{(onChangeVisible(value, node))}'
                            click3='{(onChangeVisible(value))}'
                            click4='{(onChangeVisible())}'
                            click5='{(isClicked)}'
                            width='1920'
                            height='174'
                            uri=''
                            translation='[0,0]' />
                    </children>
                </component>
            `);
            program.validate();
            await builder.build();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.be.empty;
        });

        it('gives diagnostics when trying to set a function call back as a field', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class myVM
                    function onChangeVisible(value)
                    end function
                end class
            `);
            program.setFile('components/comp.brs', ``);

            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <interface>
                    </interface>
                    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
                    <children>
                        <Poster
                            id='poster'
                            visible='{(onChangeVisible)}'
                            click='{(onChangeVisible(value))}'
                            width='1920'
                            height='174'
                            uri=''
                            translation='[0,0]' />
                    </children>
                </component>
            `);
            program.validate();
            await builder.build();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.have.lengthOf(1);
            checkDiagnostic(diagnostics[0], 1026, 8);
        });

        it('gives error diagnostics when id is not set', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class myVM
                    public text
                    function onChangeVisible(value)
                    end function
                end class
            `);
            program.setFile('components/comp.brs', ``);

            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <interface>
                    </interface>
                    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
                    <children>
                        <Poster
                            test='{{text}}'
                            click='{(onChangeVisible(event, value))}'
                            height='174'
                            uri=''
                            translation='[0,0]' />
                    </children>
                </component>
            `);
            program.validate();
            await builder.build();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.have.lengthOf(2);
            checkDiagnostic(diagnostics[0], 1010, 7);
            checkDiagnostic(diagnostics[1], 1010, 8);
        });

        it('takes optional params into account', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class myVM
                    public isClicked
                    function onChangeVisible(value = invalid, node = invalid)
                    end function
                end class
            `);
            program.setFile('components/comp.brs', ``);

            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <interface>
                    </interface>
                    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
                    <children>
                        <Poster
                            id='poster'
                            click0='{(isClicked)}'
                            click1='{(onChangeVisible())}'
                            click2='{(onChangeVisible(value))}'
                            click3='{(onChangeVisible(value, node))}'
                            click3='{(onChangeVisible(node))}'
                            width='1920'
                            height='174'
                            uri=''
                            translation='[0,0]' />
                    </children>
                </component>
            `);
            program.validate();
            await builder.build();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.be.empty;
        });

        it('inserts static bindings', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/vm.bs', `
                class myVM
                    public riversJson
                    public entry
                end class
            `);

            program.setFile('components/comp.bs', `
                class myVM
                    public riversJson
                    public entry
                end class
            `);

            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <interface>
                    </interface>
                    <script type="text/brightscript" uri="pkg:/components/comp.bs" />
                    <children>
                        <Poster
                            id='poster'
                            style='{{:riversJson.styles}}'
                            entry='{{:entry}}'
                            width='1920'
                            height='174'
                            uri=''
                            translation='[0,0]' />
                    </children>
                </component>
            `);
            program.validate();
            await builder.build();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.be.empty;
            expect(
                undent(getContents('components/comp.brs'))
            ).to.eql(undent`
                'import "pkg:/components/comp.brs"
                function __myVM_builder()
                    instance = {}
                    instance.new = sub()
                        m.riversJson = invalid
                        m.entry = invalid
                        m.__classname = "myVM"
                    end sub
                    return instance
                end function
                function myVM()
                    instance = __myVM_builder()
                    instance.new()
                    return instance
                end function

                function m_createNodeVars()
                    for each id in [
                        "poster"
                    ]
                        m[id] = m.top.findNode(id)
                    end for
                end function

                function init()
                    m_createNodeVars()
                end function

                function m_createVM()
                    m.vm = myVM()
                    m.vm.initialize()
                    mx_initializeBindings()
                end function

                function m_initBindings()
                    if m.vm <> invalid
                        vm = m.vm
                        if vm.onBindingsConfigured <> invalid
                            vm.onBindingsConfigured()
                        end if
                    end if
                end function

                function m_initStaticBindings()
                    if m.vm <> invalid
                        vm = m.vm
                        m.poster.style = mc_getPath(vm,"riversJson.styles")
                        m.poster.entry = vm.entry
                    end if
                end function
            `);
        });

        it('warns when field bindings are not public', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class myVM
                    private width
                    private function onChangeVisible(value)
                    end function
                end class
            `);
            program.setFile('components/comp.brs', ``);

            program.setFile('components/comp.xml', `
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
                </component>
            `);
            program.validate();
            expect(program.getDiagnostics()).to.not.be.empty;
            await builder.build();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.not.be.empty;
        });

        it('does not manipulate non binding xml files', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <interface>
                    </interface>
                </component>
            `);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.build();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            expect(
                undent(getContents('components/comp.xml'))
            ).to.eql(undent`
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                    <interface>
                    </interface>
                </component>
            `);
        });

        it('does removes vm tags from files files', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <interface>
                    </interface>
                </component>
            `);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.build();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            expect(
                undent(getContents('components/comp.xml'))
            ).to.eql(undent`
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                    <interface>
                    </interface>
                </component>
            `);
        });
    });

    describe('general tests', () => {

        it('does not manipulate xml files that are in default ignored folders (roku_modules)', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('components/roku_modules/mv/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" text="{{field}}" />
                    </children>
                </component>
            `);
            program.validate();
            expectZeroDiagnostics(program);
            await builder.build();
            expectZeroDiagnostics(program);

            expect(
                undent(getContents('components/roku_modules/mv/comp.xml'))
                //note - we still remove illegal vm attribute
            ).to.eql(undent`
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" text="{{field}}" />
                    </children>
                </component>
            `);
        });

        it('does not manipulate xml files when xml processing is disabled', async () => {
            plugin.maestroConfig.processXMLFiles = false;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" text="{{field}}" />
                    </children>
                </component>
            `);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.build();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            expect(
                undent(getContents('components/comp.xml'))
                //note - we still remove illegal vm attribute
            ).to.eql(undent`
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" text="{{field}}" />
                    </children>
                </component>
            `);
        });

        it('can turnoff default default ignored folders ', async () => {
            plugin.maestroConfig = {
                extraValidation: {},
                addFrameworkFiles: false,
                excludeFilters: [],
                mvvm: {},
                nodeClasses: {},
                processXMLFiles: true
            };
            plugin.importProcessor.config = plugin.maestroConfig;

            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('components/roku_modules/mv/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" text="{{field}}" />
                    </children>
                </component>
            `);
            program.validate();
            expect(program.getDiagnostics()).to.not.be.empty;
            await builder.build();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.not.be.empty;

            expect(
                undent(getContents('components/roku_modules/mv/comp.xml'))
            ).to.eql(undent`
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" />
                    </children>
                </component>
            `);
        });

        it('does not manipulate files in specified folders ', async () => {
            plugin.maestroConfig = {
                extraValidation: {},
                addFrameworkFiles: false,
                excludeFilters: ['**/ignored/**/*.*'],
                mvvm: {},
                nodeClasses: {}
            };
            plugin.importProcessor.config = plugin.maestroConfig;

            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('components/ignored/mv/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" text="{{field}}" />
                    </children>
                </component>
            `);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.build();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            expect(
                undent(getContents('components/ignored/mv/comp.xml'))
            ).to.eql(undent`
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                    <interface>
                    </interface>
                    <children>
                        <Label id="test" text="{{field}}" />
                    </children>
                </component>
            `);
        });
    });

    describe('node class tests', () => {
        it('parses a node class with no errors', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function
                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.equal(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="title" type="string" />
                    <field id="content" type="string" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.title = ""
                m.top.content = ""

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });

        it('parses tunnels public functions', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function

                    public function someFunction()
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="title" type="string" />
                    <field id="content" type="string" />
                    <function name="someFunction" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.title = ""
                m.top.content = ""

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function


            function someFunction(dummy = invalid)

                    return m.someFunction()
            end function`);
        });

        it('ternary works with m.top substitution', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public validText = ""
                    public invalidText = ""
                    public text = ""
                    public isValid = false

                    function new()
                    end function

                    public function someFunction()
                        m.text = m.isValid ? m.validText : m.invalidText
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="validText" type="string" />
                    <field id="invalidText" type="string" />
                    <field id="text" type="string" />
                    <field id="isValid" type="boolean" />
                    <function name="someFunction" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.validText = ""
                m.top.invalidText = ""
                m.top.text = ""
                m.top.isValid = false

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function


            function someFunction(dummy = invalid)

                    return m.someFunction()
            end function
            `);

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
            function __Comp_builder()
                instance = {}
                instance.new = function()
                    m.validText = ""
                    m.invalidText = ""
                    m.text = ""
                    m.isValid = false
                    m.__classname = "Comp"
                end function
                instance.someFunction = function()
                    m.text = (function(__bsCondition, m)
                            if __bsCondition then
                                return m.validText
                            else
                                return m.invalidText
                            end if
                        end function)(m.isValid, m)
                end function
                return instance
            end function
            function Comp()
                instance = __Comp_builder()
                instance.new()
                return instance
            end function`);
        });

        it('does not generate code behind if nocode annotation is present', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @nocode
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function

                    public function someFunction()
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="title" type="string" />
                    <field id="content" type="string" />
                    <function name="someFunction" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(fsExtra.pathExistsSync(path.join(_stagingFolderPath, 'components/maestro/generated/Comp.brs'))).to.be.false;
        });

        it('parses tunnels public functions with parameter', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function

                    public function defaultAndType(x = 5 as integer, y = 10 as integer)
                    end function

                    public function defaultOnly(x = 5, y = 10)
                    end function

                    public function typeOnly(x as integer, y as integer)
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="title" type="string" />
                    <field id="content" type="string" />
                    <function name="defaultAndType" />
                    <function name="defaultOnly" />
                    <function name="typeOnly" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.title = ""
                m.top.content = ""

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function


            function defaultAndType(x = 5,y = 10 )
                return m.defaultAndType(x,y )

            end function

            function defaultOnly(x = 5,y = 10 )
                return m.defaultOnly(x,y )

            end function

            function typeOnly(x = invalid,y = invalid )
                return m.typeOnly(x,y )

            end function`);
        });

        it('parses tunnels public functions with parameter, when enum or interface', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function

                    public function both(color = test.Color.red as test.Color, color2 = test.Color.green as test.Color)
                    end function

                    public function defaultOnly(color = test.Color.red, color2 = test.Color.green)
                    end function

                    public function typeOnly(color as test.Color, color2 as test.Color)
                    end function

                end class

                namespace test
                    enum Color
                        red = 1
                        green = 2
                    end enum
                end namespace
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="title" type="string" />
                    <field id="content" type="string" />
                    <function name="both" />
                    <function name="defaultOnly" />
                    <function name="typeOnly" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);
            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.title = ""
                m.top.content = ""

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function


            function both(color = 1,color2 = 2 )
                return m.both(color,color2 )

            end function

            function defaultOnly(color = 1,color2 = 2 )
                return m.defaultOnly(color,color2 )

            end function

            function typeOnly(color = invalid,color2 = invalid )
                return m.typeOnly(color,color2 )

            end function`);
        });

        it('hooks up public fields with observers', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="title" type="string" />
                    <field id="content" type="string" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);
            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.title = ""
                m.top.content = ""

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

                function on_title(event)
                m.onTitleChange(event.getData())
                        end function

            function m_wireUpObservers()

            m.top.observeField("title", "on_title")

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });

        it('hooks up public fields with observers - allows @rootOnly observer', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @rootOnly
                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="title" type="string" />
                    <field id="content" type="string" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.title = ""
                m._p_title = invalid
                m.top.content = ""

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

                function on_title(event)
                v = event.getData()
                    if type(v) <> "roSGNode" or not v.isSameNode(m._p_title)
                    m._p_title = v
                    m.onTitleChange(event.getData())
                    end if
                    end function

            function m_wireUpObservers()

            m.top.observeField("title", "on_title")

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });

        it('manages inferred and specific field types', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class TestClass
                end class
                @node("Comp", "Group")
                class Comp

                public clazzTyped as TestClass
                    public s = "string"
                    public num = 2
                    public numFloat = 2.5
                    public arr = [1,2,3]
                    public aa = {id:"1"}
                    public clazz = new TestClass()
                    public sTyped as string
                    public numTyped as integer
                    public numFloatTyped as float
                    public arrTyped as roArray
                    public aaTyped as roAssociativeArray
                    public nodeTyped as roSGNode

                    function new()
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && !d.message.includes('Cannot find name \'mc\''))).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="clazzTyped" type="assocarray" />
                    <field id="s" type="string" />
                    <field id="num" type="integer" />
                    <field id="numFloat" type="float" />
                    <field id="arr" type="array" />
                    <field id="aa" type="assocarray" />
                    <field id="clazz" type="assocarray" />
                    <field id="sTyped" type="string" />
                    <field id="numTyped" type="integer" />
                    <field id="numFloatTyped" type="float" />
                    <field id="arrTyped" type="array" />
                    <field id="aaTyped" type="assocarray" />
                    <field id="nodeTyped" type="node" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.clazzTyped = invalid
                m.top.s = "string"
                m.top.num = 2
                m.top.numFloat = 2.5
                m.top.arr = [1,2,3]
                m.top.aa = {id: "1"}
                m.top.clazz = invalid
                m.top.sTyped = invalid
                m.top.numTyped = invalid
                m.top.numFloatTyped = invalid
                m.top.arrTyped = invalid
                m.top.aaTyped = invalid
                m.top.nodeTyped = invalid

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });

        it('supports enum type in public fields', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                enum myEnum
                    text = "v"
                end enum
                namespace myNamespace
                    enum nsEnum1
                        value1 = 1.0
                        floatValue = 2.0
                    end enum
                end namespace
                class TestClass
                end class
                @node("Comp", "Group")
                class Comp

                    public e1 = myEnum.text
                    public e2 = myNamespace.nsEnum1.value1
                    public e3 = myNamespace.nsEnum1.floatValue

                    function new()
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expectZeroDiagnostics(builder);

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="e1" type="string" />
                    <field id="e2" type="float" />
                    <field id="e3" type="float" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>`);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.e1 = "v"
                m.top.e2 = 1
                m.top.e3 = 2

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });
        it('supports negative integers and floats in public fields', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public e1 = -1
                    public e2 = -100.0

                    function new()
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.build();
            expectZeroDiagnostics(builder);

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="e1" type="integer" />
                    <field id="e2" type="float" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>
            `);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.e1 = -1
                m.top.e2 = -100

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });
        it('supports interface type in public fields', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                interface myInterface
                    text as string
                end interface
                namespace myNamespace
                    interface myInterface
                        text as string
                    end interface
                end namespace
                @node("Comp", "Group")
                class Comp

                    public e1 as myInterface
                    public e2 as myNamespace.myInterface

                    function new()
                    end function
                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && !d.message.includes('mc.types.'))).to.be.empty;

            expect(
                undent(getContents('components/maestro/generated/Comp.xml'))
            ).to.eql(undent`
            <?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
                <interface>
                    <field id="e1" type="assocarray" />
                    <field id="e2" type="assocarray" />
                </interface>
                <script uri="pkg:/source/comp.brs" type="text/brightscript" />
                <script uri="pkg:/components/maestro/generated/Comp.brs" type="text/brightscript" />
                <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                <children>
                </children>
            </component>
            `);

            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.e1 = invalid
                m.top.e2 = invalid

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });

        it('gives diagnostics for missing observer function params', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function
                end class
            `);
            program.validate();
            await builder.build();
            assertHasDiagnostic(builder, 'MSTO1036');
        });

        it('does not give diagnostics for missing new function', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp
                    public content = ""
                end class
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            expect(
                undent(getContents('components/maestro/generated/Comp.brs'))
            ).to.eql(undent`
            function init()
                m.top.content = ""

                instance = __Comp_builder()
                instance.delete("top")
                instance.delete("global")
                top = m.top
                m.append(instance)
                m.__isVMCreated = true
                m.new()
                m.top = top
                m_wireUpObservers()

            end function

            function m_wireUpObservers()

            end function

            function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
            end function`);
        });

    });

    it('gives diagnostics when a task does not extend task', async () => {
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
                @task("TaskTest", "Group")
                class Comp
                    function execute(args)
                    end function
                end class
            `);
        program.validate();
        await builder.build();
        assertHasDiagnostic(builder, 'MSTO1029');
    });

    it('gives diagnostics when a task nor parent extending component does not extend task', async () => {
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
            @node("ParentTask", "Group")
            class Extended
            end class
        `);

        program.setFile('source/comp2.bs', `
        @task("TaskTest", "ParentTask")
        class Comp
        function execute(args)
        end function
        end class
        `);
        program.validate();
        await builder.build();
        assertHasDiagnostic(builder, 'MSTO1029');
    });
    it('does not give diagnostics when parent extends Task', async () => {
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
            @task("ParentTask", "Task")
            class Extended
            function execute(args)
            end function
            end class
        `);

        program.setFile('source/comp2.bs', `
                @task("TaskTest", "ParentTask")
                class Comp
                    function execute(args)
                    end function
                end class
            `);
        program.validate();
        await builder.build();
        expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
        expect(
            undent(getContents('components/maestro/generated/TaskTest.brs'))
        ).to.eql(undent`
        function __m_setTopField(field, value)
            if m.top.doesExist(field)
                m.top[field] = value
            end if
            return value
        end function


        function init()
            m.top.functionName="exec"
        end function

        function exec()
            instance = __Comp_builder()
            m.top.output = mc_private_taskExec(instance)
        end function`);

        expect(
            undent(getContents('components/maestro/generated/TaskTest.xml'))
        ).to.eql(undent`<?xml version="1.0" encoding="UTF-8" ?>
        <component name="TaskTest" extends="ParentTask">
            <interface>
                <field id="args" type="assocarray" />
                <field id="output" type="assocarray" />
                <function name="exec" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/roku_modules/maestro/private/MaestroPluginUtils.brs" />
            <script uri="pkg:/source/comp2.brs" type="text/brightscript" />
            <script uri="pkg:/components/maestro/generated/TaskTest.brs" type="text/brightscript" />
            <children>
            </children>
        </component>`);
    });

    it('does not give diagnostics when regular component extends Task', async () => {
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
                @task("TaskTest", "Task")
                class Comp
                    function execute(args)
                    end function
                end class
            `);
        program.validate();
        await builder.build();
        expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

        expect(
            undent(getContents('components/maestro/generated/TaskTest.brs'))
        ).to.eql(undent`
        function __m_setTopField(field, value)
            if m.top.doesExist(field)
                m.top[field] = value
            end if
            return value
        end function


        function init()
            m.top.functionName="exec"
        end function

        function exec()
            instance = __Comp_builder()
            m.top.output = mc_private_taskExec(instance)
        end function`);
        expect(
            undent(getContents('components/maestro/generated/TaskTest.xml'))
        ).to.eql(undent`
        <?xml version="1.0" encoding="UTF-8" ?>
        <component name="TaskTest" extends="Task">
            <interface>
                <field id="args" type="assocarray" />
                <field id="output" type="assocarray" />
                <function name="exec" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/roku_modules/maestro/private/MaestroPluginUtils.brs" />
            <script uri="pkg:/source/comp.brs" type="text/brightscript" />
            <script uri="pkg:/components/maestro/generated/TaskTest.brs" type="text/brightscript" />
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            </children>
        </component>`);

    });
    it('does not produce diagnostics for missing observer function when extra validation is enabled', async () => {
        plugin.maestroConfig.extraValidation.doExtraValidation = false;
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function
                end class
            `);
        program.validate();
        await builder.build();
        expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
        expect(
            undent(getContents('components/maestro/generated/Comp.brs'))
        ).to.eql(undent`
        function init()
            m.top.title = ""
            m.top.content = ""

            instance = __Comp_builder()
            instance.delete("top")
            instance.delete("global")
            top = m.top
            m.append(instance)
            m.__isVMCreated = true
            m.new()
            m.top = top
            m_wireUpObservers()

        end function

        function on_title(event)
            m.onTitleChange()
        end function

        function m_wireUpObservers()

            m.top.observeField("title", "on_title")

        end function

        function __m_setTopField(field, value)
                if m.top.doesExist(field)
                    m.top[field] = value
                end if
                return value
        end function`);
    });

    it('gives diagnostics for wrong observer function params', async () => {
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function

                    private function onTitleChange(too, manyParams)
                    end function

                end class
            `);
        program.validate();
        await builder.build();
        assertHasDiagnostic(builder, 'MSTO1038');
    });

    it('gives diagnostics for wrong constructor function params', async () => {
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
        @node("Comp", "Group")
        class Comp

        @observer("onTitleChange")
        public title = ""
        public content = ""

        function new()
        end function
        end class
        `);
        program.validate();
        await builder.build();
        expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;
        assertHasDiagnostic(builder, 'MSTO1036');

    });
    it('gives diagnostics for no constructor', async () => {
        plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
        program.setFile('source/comp.bs', `
        @node("Comp", "Group")
        class Comp

        @observer("onTitleChange")
        public title = ""
        public content = ""

        end class
        `);
        program.validate();
        await builder.build();
        assertHasDiagnostic(builder, 'MSTO1036');
    });

    describe('reflection', () => {

        it('adds __classname to all classes in a project', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function
               end class
            `);
            program.setFile('source/myClass.bs', `
                class myClass
                    public title
                end class
                namespace myNamespace
                        class myNamespacedClass
                            public title
                        end class
                end namespace
            `);
            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            let classFile = program.getFile<BrsFile>('source/myClass.bs');
            let cs = classFile.parser.references.classStatements[0];
            expect(cs.body.length === 3);
            expect(cs.fields.length === 2);
            expect(cs.memberMap['__className'].name.text === '__className');
            expect(
                undent(getContents('source/myClass.brs'))
            ).to.eql(undent`
                function __myClass_builder()
                    instance = {}
                    instance.new = sub()
                        m.title = invalid
                        m.__classname = "myClass"
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
                        m.__classname = "myNamespace.myNamespacedClass"
                    end sub
                    return instance
                end function
                function myNamespace_myNamespacedClass()
                    instance = __myNamespace_myNamespacedClass_builder()
                    instance.new()
                    return instance
                end function
            `);
            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function __Comp_builder()
                    instance = {}
                    instance.new = function()
                        m.title = ""
                        m.content = ""
                        m.__classname = "Comp"
                    end function
                    return instance
                end function
                function Comp()
                    instance = __Comp_builder()
                    instance.new()
                    return instance
                end function
            `);
        });

        it('adds __classname, in subclasses', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/myClass.bs', `
                class ClassA
                    public title
                end class
                class ClassB extends ClassA
                    public title2
                end class
            `);
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            let classFile = program.getFile<BrsFile>('source/myClass.bs');
            let cs = classFile.parser.references.classStatements[0];
            expect(cs.body.length === 3);
            expect(cs.fields.length === 2);
            expect(cs.memberMap['__className'].name.text === '__className');
            expect(
                undent(getContents('source/myClass.brs'))
            ).to.eql(undent`
                function __ClassA_builder()
                    instance = {}
                    instance.new = sub()
                        m.title = invalid
                        m.__classname = "ClassA"
                    end sub
                    return instance
                end function
                function ClassA()
                    instance = __ClassA_builder()
                    instance.new()
                    return instance
                end function
                function __ClassB_builder()
                    instance = __ClassA_builder()
                    instance.super0_new = instance.new
                    instance.new = sub()
                        m.super0_new()
                        m.title2 = invalid
                        m.__classname = "ClassB"
                    end sub
                    return instance
                end function
                function ClassB()
                    instance = __ClassB_builder()
                    instance.new()
                    return instance
                end function
            `);
        });

        describe('extra validation', () => {

            it('gives diagnostic for unknown field', () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
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

            it('gives diagnostic for unknown field; but skips valid skips', () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    @strict
                    class VM
                        public fieldA
                        function doStuff()
                        ? m.__className
                        m.__className = "foo"
                        ? m.doesExist("foo")
                        ? m.lookup("foo")
                        ? m.keys()
                        ? m.count()
                        end function
                    end class
                `);
                program.validate();
                expectDiagnostics(builder, [{ message: `Cannot find name '__className'` }]);
            });

            it('gives diagnostic for  unknown function', () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
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
            it('does not give diagnostic for field in superclass', () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        public isThere
                        protected isThereToo
                    end class
                `);

                program.setFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.isthere = true
                        m.isthereToo = true
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });
            it('takes into account d files from roku modules', () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        public isThere
                    end class
                `);

                program.setFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.isthere = true
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });

            it('does not give diagnostic for function in superclass', () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        function there()
                        end function
                    end class
                `);

                program.setFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.there()
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });
            it('gives diagnostics for function that is not in scope', async () => {
                plugin.maestroConfig.extraValidation.doExtraImportValidation = true;
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
                program.setFile('source/superComp.bs', `
                namespace stuff
                    class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function

                    private function getTheTitle(title)
                    end function
                    end class
                    function notImported()
                    end function
                end namespace
                `);
                program.setFile('source/comp.bs', `
                'import "pkg:/source/superComp.bs"
                `);
                program.setFile('source/comp2.bs', `
                    import "pkg:/source/comp.bs"
                    class Comp2

                        function new(thing)
                            thing = new stuff.Comp()
                            stuff.notImported()
                            ? thing.title
                            ? thing.content
                            ? thing.getTheTitle("hello")
                        end function
                    end class
                `);
                program.validate();
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

            });

            it('does not give extra validation error when disabled', async () => {
                plugin.maestroConfig.extraValidation.doExtraImportValidation = false;
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
                program.setFile('source/superComp.bs', `
                    namespace stuff
                        class Comp

                        public title = ""
                        public content = ""

                        function new()
                        end function

                        private function getTheTitle(title)
                        end function
                        end class
                        function notImported()
                        end function
                    end namespace
                `);
                program.setFile('source/comp.bs', `
                    'import "pkg:/source/superComp.bs"
                `);
                program.setFile('source/comp2.bs', `
                    import "pkg:/source/comp.bs"
                    class Comp2

                        function new(thing)
                            thing = new stuff.Comp()
                            stuff.notImported()
                            ? thing.title
                            ? thing.content
                            ? thing.getTheTitle("hello")
                        end function
                    end class
                `);
                program.validate();
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });
        });

        describe('vms', () => {
            it('replaces m.value = with m.setField', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
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
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                expect(
                    undent(getContents('source/VM.brs'))
                ).to.eql(undent`
                    function __VM_builder()
                        instance = {}
                        instance.new = sub()
                            m.fieldA = invalid
                            m.fieldB = invalid
                            m.fieldC = invalid
                            m.__classname = "VM"
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
                    end function
                `);
            });

            it('replaces m.value = with m.setField, when field is defined in super class', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    @useSetField
                    class VM

                        public fieldA
                        public fieldB
                        private fieldC
                        function doStuff()
                        end function
                   end class
                    class ChildVM extends VM
                        override function doStuff()
                            m.setField("fieldA", "val1")
                            m.fieldA = "val1"
                            m.fieldB = {this:"val2"}
                            m.fieldC = {this:"val1"}
                            m.notKnown = true
                            something = {}
                            m.fieldA = something.getValues({this:"val1"}, "key")
                        end function
                   end class
                `);
                program.validate();
                await builder.build();

                // expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                expect(
                    undent(getContents('source/VM.brs'))
                ).to.eql(undent`
            function __VM_builder()
                instance = {}
                instance.new = sub()
                    m.fieldA = invalid
                    m.fieldB = invalid
                    m.fieldC = invalid
                    m.__classname = "VM"
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
                end sub
                instance.super0_doStuff = instance.doStuff
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
                    something = {}
                    m.setField("fieldA", something.getValues({
                        this: "val1"
                    }, "key"))
                end function
                return instance
            end function
            function ChildVM()
                instance = __ChildVM_builder()
                instance.new()
                return instance
            end function
                `);
            });
        });

        describe('ioc', () => {
            it('wires up fields with inject annotations', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        @inject("Entitlements")
                        public fieldA
                        @injectClass("mc.collections.FieldMapper")
                        public fieldB
                   end class
                   namespace mc.collections
                    class FieldMapper
                    end class
                   end namespace
                `);
                program.validate();
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                expect(
                    undent(getContents('source/VM.brs'))
                ).to.eql(undent`
                    function __VM_builder()
                        instance = {}
                        instance.new = sub()
                            m.fieldA = mioc_getInstance("Entitlements", invalid, invalid)
                            m.fieldB = mioc_getClassInstance("mc.collections.FieldMapper")
                            m.__classname = "VM"
                        end sub
                        return instance
                    end function
                    function VM()
                        instance = __VM_builder()
                        instance.new()
                        return instance
                    end function
                    function __mc_collections_FieldMapper_builder()
                        instance = {}
                        instance.new = sub()
                            m.__classname = "mc.collections.FieldMapper"
                        end sub
                        return instance
                    end function
                    function mc_collections_FieldMapper()
                        instance = __mc_collections_FieldMapper_builder()
                        instance.new()
                        return instance
                    end function
                `);
            });
            it('wires up fields with inject annotations and uses default values', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        @inject("myString")
                        public fieldA = "defaultKey"
                        @inject("myBool")
                        public fieldB = true
                        @inject("myKey", "fromHere")
                        public fieldC = 23
                        @inject("myKey")
                        public fieldD as string
                        @inject("myKey")
                        public fieldE as boolean
                        @inject("myKey")
                        public fieldF as integer
                        @inject("myKey", "fromHere")
                        public fieldG as string
                        @inject("myKey", "fromHere")
                        public fieldH as boolean
                        @inject("myKey", "fromHere")
                        public fieldI as integer
                        @inject("myKey")
                        public fieldJ as roAssociativeArray
                        @inject("myKey")
                        public fieldK as roArray
                        @inject("myKey")
                        public fieldL = []
                        @inject("myKey")
                        public fieldM = ["one", "two"]
                        @inject("myKey")
                        public fieldN = {}
                        @inject("myKey")
                        public fieldO = {"one": "two"}
                   end class
                   namespace mc.collections
                    class FieldMapper
                    end class
                   end namespace
                `);
                program.validate();
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                expect(
                    undent(getContents('source/VM.brs'))
                ).to.eql(undent`
                function __VM_builder()
                    instance = {}
                    instance.new = sub()
                        m.fieldA = mioc_getInstance("myString", invalid, "defaultKey")
                        m.fieldB = mioc_getInstance("myBool", invalid, true)
                        m.fieldC = mioc_getInstance("myKey", "fromHere", 23)
                        m.fieldD = mioc_getInstance("myKey", invalid, "")
                        m.fieldE = mioc_getInstance("myKey", invalid, false)
                        m.fieldF = mioc_getInstance("myKey", invalid, 0)
                        m.fieldG = mioc_getInstance("myKey", "fromHere", "")
                        m.fieldH = mioc_getInstance("myKey", "fromHere", false)
                        m.fieldI = mioc_getInstance("myKey", "fromHere", 0)
                        m.fieldJ = mioc_getInstance("myKey", invalid, {})
                        m.fieldK = mioc_getInstance("myKey", invalid, [])
                        m.fieldL = mioc_getInstance("myKey", invalid, [])
                        m.fieldM = mioc_getInstance("myKey", invalid, [
                            "one"
                            "two"
                        ])
                        m.fieldN = mioc_getInstance("myKey", invalid, {})
                        m.fieldO = mioc_getInstance("myKey", invalid, {
                            "one": "two"
                        })
                        m.__classname = "VM"
                    end sub
                    return instance
                end function
                function VM()
                    instance = __VM_builder()
                    instance.new()
                    return instance
                end function
                function __mc_collections_FieldMapper_builder()
                    instance = {}
                    instance.new = sub()
                        m.__classname = "mc.collections.FieldMapper"
                    end sub
                    return instance
                end function
                function mc_collections_FieldMapper()
                    instance = __mc_collections_FieldMapper_builder()
                    instance.new()
                    return instance
                end function`);
            });

            it('honors enums as default values', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        @inject("myEnum")
                        public fieldA = mc.enumValue.first
                        @inject("myEnum")
                        public fieldB = mc.enumValue.second
                        @inject("myEnum")
                        public fieldC = mc.enumIntValue.first
                        @inject("myEnum")
                        public fieldD = mc.enumIntValue.second
                   end class
                   namespace mc
                        enum enumValue
                            first = "firstValue"
                            second = "secondValue"
                        end enum
                        enum enumIntValue
                            first = 1
                            second = 2
                        end enum
                   end namespace
                `);
                program.validate();
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                expect(
                    undent(getContents('source/VM.brs').trim())
                ).to.eql(undent`
                    function __VM_builder()
                        instance = {}
                        instance.new = sub()
                            m.fieldA = mioc_getInstance("myEnum", invalid, "firstValue")
                            m.fieldB = mioc_getInstance("myEnum", invalid, "secondValue")
                            m.fieldC = mioc_getInstance("myEnum", invalid, 1)
                            m.fieldD = mioc_getInstance("myEnum", invalid, 2)
                            m.__classname = "VM"
                        end sub
                        return instance
                    end function
                    function VM()
                        instance = __VM_builder()
                        instance.new()
                        return instance
                    end function`.trim());
            });

            it('allows instantiation of class objects from annotation', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        @inject("Entitlements")
                        public fieldA
                        @createClass("ChildVM")
                        public fieldB
                        @createClass("ChildVM", "arg1", "arg2")
                        public fieldC
                    end class
                    class ChildVM extends VM
                    end class
                `);
                program.validate();
                await builder.build();
                expectZeroDiagnostics(builder);
                expect(
                    undent(getContents('source/VM.brs'))
                ).to.eql(undent`
                    function __VM_builder()
                        instance = {}
                        instance.new = sub()
                            m.fieldA = mioc_getInstance("Entitlements", invalid, invalid)
                            m.fieldB = mioc_createClassInstance("ChildVM")
                            m.fieldC = mioc_createClassInstance("ChildVM", ["arg1","arg2"])
                            m.__classname = "VM"
                        end sub
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
                        end sub
                        return instance
                    end function
                    function ChildVM()
                        instance = __ChildVM_builder()
                        instance.new()
                        return instance
                    end function
                `);
            });

            it('gives diagnostics when the injection annotations are malformed', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class VM
                        @inject()
                        public fieldA
                        @inject("")
                        public fieldB
                        @createClass("")
                        public fieldC
                        @createClass("notInScope")
                        public fieldD
                        @createClass("ChildVM", bad, values) 'bs:disable-line 1001
                        public fieldE
                        @sync
                        @inject("noPathPublic")
                        public fieldF
                        @sync
                        @inject("noPath")
                        private fieldG
                        @sync
                        @inject("notPrivate", "name")
                        public fieldH
                    end class
                `);
                program.validate();
                await builder.build();
                expectDiagnostics(program, [
                    { code: 'MSTO1042', message: 'Inject annotation on VM.fieldA must supply one argument' },
                    { code: 'MSTO1042', message: 'Inject annotation on VM.fieldB must supply one argument' },
                    { code: 'MSTO1042', message: 'Inject annotation on VM.fieldC must supply one argument' },
                    //TODO why is this diagnostic missing?
                    // { code: 'MSTO1043', message: 'cannot inject ChildVM into field VM.fieldE. It is not in scope' },
                    { code: 'MSTO1043', message: 'cannot inject notInScope into field VM.fieldD. It is not in scope' },
                    { code: 'MSTO1056' },
                    { code: 'MSTO1056' },
                    { code: 'MSTO1057' }
                ]);
            });

            it('gives diagnostics when the injection public field with sync @nodeclass', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    @node("test", "Group")
                    class VM
                        @sync
                        @inject("user","publicInvalid")
                        public fieldA as string
                        @sync
                        @inject("user", "valid")
                        private fieldB as string

                        function new()
                        end function
                    end class
                `);
                program.validate();
                await builder.build();
                let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error);
                expect(d).to.have.lengthOf(1);
                expect(d[0].code).to.equal('MSTO1056');
            });

            it('gives diagnostic when a public nodeclass function has too many params', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    @node("test", "Group")
                    class VM
                        function okay1(a1 as string)
                        end function
                        function okay2(a1 as string, a2 as string)
                        end function
                        function okay3(a1 as string, a2 as string, a3 as string)
                        end function
                        function okay4(a1 as string, a2 as string, a3 as string, a4 as string)
                        end function
                        function okay5(a1 as string, a2 as string, a3 as string, a4 as string, a5 as string)
                        end function
                        function tooManyArgs(a1 as string, a2 as string, a3 as string, a4 as string, a5 as string, a6 as string)
                        end function

                        function new()
                        end function
                    end class
                `);
                program.validate();
                await builder.build();
                let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error);
                expect(d).to.have.lengthOf(1);
                expect(d[0].code).to.equal('MSTO1060');
            });

            it('allows observing of an injected field', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class MyView
                        @sync
                        @inject("Entitlements", "isLoggedIn")
                        private fieldA
                        @sync
                        @inject("user", "Entitlements.isLoggedIn")
                        private fieldB
                        @sync
                        @inject("user", "Entitlements.valid.isLoggedIn")
                        private fieldC
                        @sync
                        @observer("onFieldChange")
                        @inject("Entitlements", "isLoggedIn")
                        private fieldD
                        @sync
                        @observer("onFieldChange")
                        @inject("user", "Entitlements.isLoggedIn")
                        private fieldE
                        @sync
                        @observer("onFieldChange")
                        @inject("user", "Entitlements.valid.isLoggedIn")
                        private fieldF

                        function onFieldChange(value)
                        end function
                    end class
                `);
                program.validate();
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                expect(
                    undent(getContents('source/VM.brs'))
                ).to.eql(undent`
                    function __MyView_builder()
                        instance = {}
                        instance.new = sub()
                            m.fieldA = m._addIOCObserver("fieldA", "Entitlements", "isLoggedIn", "", "isLoggedIn", invalid)
                            m.fieldB = m._addIOCObserver("fieldB", "user", "Entitlements.isLoggedIn", "Entitlements", "isLoggedIn", invalid)
                            m.fieldC = m._addIOCObserver("fieldC", "user", "Entitlements.valid.isLoggedIn", "Entitlements.valid", "isLoggedIn", invalid)
                            m.fieldD = m._addIOCObserver("fieldD", "Entitlements", "isLoggedIn", "", "isLoggedIn", m.onfieldchange )
                            m.fieldE = m._addIOCObserver("fieldE", "user", "Entitlements.isLoggedIn", "Entitlements", "isLoggedIn", m.onfieldchange )
                            m.fieldF = m._addIOCObserver("fieldF", "user", "Entitlements.valid.isLoggedIn", "Entitlements.valid", "isLoggedIn", m.onfieldchange )
                            m.__classname = "MyView"
                        end sub
                        instance.onFieldChange = function(value)
                        end function
                        return instance
                    end function
                    function MyView()
                        instance = __MyView_builder()
                        instance.new()
                        return instance
                    end function
                `);
            });

            it('allows injecting with a dot value', async () => {
                plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);

                program.setFile('source/VM.bs', `
                    class MyView
                        @inject("Entitlements.isLoggedIn")
                        private fieldA
                        @inject("user.Entitlements.isLoggedIn")
                        private fieldB

                        @sync
                        @inject("Entitlements.isLoggedIn")
                        private fieldC

                        @sync
                        @inject("user.Entitlements.isLoggedIn")
                        private fieldD

                        function onFieldChange(value)
                        end function
                    end class
                `);
                program.validate();
                await builder.build();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                expect(
                    undent(getContents('source/VM.brs'))
                ).to.eql(undent`
                function __MyView_builder()
                    instance = {}
                    instance.new = sub()
                        m.fieldA = mioc_getInstance("Entitlements", "isLoggedIn", invalid)
                        m.fieldB = mioc_getInstance("user", "Entitlements.isLoggedIn", invalid)
                        m.fieldC = m._addIOCObserver("fieldC", "Entitlements", "isLoggedIn", "", "isLoggedIn", invalid)
                        m.fieldD = m._addIOCObserver("fieldD", "user", "Entitlements.isLoggedIn", "Entitlements", "isLoggedIn", invalid)
                        m.__classname = "MyView"
                    end sub
                    instance.onFieldChange = function(value)
                    end function
                    return instance
                end function
                function MyView()
                    instance = __MyView_builder()
                    instance.new()
                    return instance
                end function`);
            });
        });
    });

    describe('Tranpsiles import processing', () => {
        it('adds build time imports', async () => {
            plugin.maestroConfig = {
                extraValidation: {},
                addFrameworkFiles: false,
                mvvm: {},
                processXMLFiles: true,
                nodeClasses: {},
                buildTimeImports: {
                    'IAuthProvider': ['pkg:/source/AuthManager.bs']
                }
            };

            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('components/comp.xml', `
                <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
                    <interface>
                    </interface>
                </component>
            `);


            program.setFile('components/comp.bs', `
                import "build:/IAuthProvider"
            `);
            program.setFile('source/AuthManager.bs', `
                sub hello()
                end sub
            `);

            program.validate();
            await builder.build();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            expect(
                undent(getContents('components/comp.xml'))
            ).to.eql(undent`
                <component name="mv_BaseScreen" extends="mv_BaseView">
                    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
                    <script type="text/brightscript" uri="pkg:/source/AuthManager.brs" />
                    <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
                    <interface>
                    </interface>
                </component>
            `);
            expect(
                undent(getContents('components/comp.brs'))
            ).to.eql(undent`
                'import "pkg:/source/AuthManager.bs"

                function m_createNodeVars()
                end function

                function init()
                    m_createNodeVars()
                end function
            `);
        });
    });


    describe.skip('run a local project (zp)', () => {
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
                        'src': '**/Whitelist.xml',
                        'codes': [
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
    describe.skip('run a local project (s)', () => {
        it('sanity checks on parsing - only run this outside of ci', () => {
            const p = {
                'stagingFolderPath': 'build',
                'rootDir': '/home/george/hope/nba/nba-roku',
                'files': [
                    '!**/*.i8n.json',
                    'manifest',
                    'source/**/*.*',
                    'images/**/*.*',
                    'sounds/**/*.*',
                    'sounds/*.*',
                    'fonts/**/*.*',
                    'meta/**/*.*',
                    'components/**/*.*',
                    { 'src': '../src-dev/source/**/*.*', 'dest': 'source' }
                ],
                'autoImportComponentScript': true,
                'createPackage': false,
                'diagnosticFilters': [
                    {
                        'src': '**/roku_modules/**/*.*'
                    },
                    {
                        'src': '**/RALETrackerTask.*'
                    },
                    {
                        'src': '**/*spec.bs',
                        'codes': ['LINT3011']
                    },
                    {
                        'src': '**/bitmovinAnalytics/**/*.*'
                    },
                    {
                        'src': '**/bitmovinPlayer/**/*.*'
                    },
                    {
                        'src': '**/mediakind/**/*.*'
                    },
                    {
                        'src': '**/NewRelicAgent/**/*.*'
                    },
                    {
                        'src': '**/NewRelicAgent.brs'
                    }
                ],
                'plugins': [
                    '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
                    '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
                ],
                'maestro': {
                    'excludeFilters': [
                        '**/roku_modules/**/*',
                        '**/node_modules/**/*',
                        '**/rooibos/**/*',
                        '**/bitmovinAnalytics/**/*.*',
                        '**/bitmovinPlayer/**/*.*',
                        '**/mediakind/**/*.*',
                        '**/NewRelicAgent/**/*.*',
                        '**/NewRelicAgent.brs'
                    ],
                    'buildForIDE': true,
                    'extraValidation': {
                        'doExtraValidation': true,
                        'doExtraImportValidation': true
                    }
                },
                'rooibos': {
                    'isRecordingCodeCoverage': false,
                    'testsFilePattern': null
                },
                'rokuLog': {
                    'strip': false,
                    'insertPkgPath': true,
                    'removeComments': true
                },
                'logLevel': 'error',
                'retainStagingFolder': true,
                'transpileOptions': {
                    'removeParameterTypes': true
                }
            };

            let programBuilder = new ProgramBuilder();
            programBuilder.run(p as any).catch(e => {
                console.error(e);
            });
        });
        it('MV', () => {
            let config = {
                'rootDir': 'src',
                'files': [
                    'manifest',
                    'source/**/*.*',
                    'components/**/*.*'
                ],
                'autoImportComponentScript': true,
                'createPackage': false,
                'stagingFolderPath': 'build',
                'diagnosticFilters': [
                    {
                        'src': '**/roku_modules/**/*.*'
                    },
                    {
                        'src': '**/WhiteList.xml',
                        'codes': [
                            1067
                        ]
                    },
                    1120
                ],
                'emitDefinitions': true,
                'plugins': [
                    '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
                    '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
                ],
                'rooibos': {
                    'isRecordingCodeCoverage': false,
                    'testsFilePattern': null,
                    'tags': [
                        '!integration',
                        '!deprecated',
                        '!fixme'
                    ],
                    'showOnlyFailures': true,
                    'catchCrashes': true,
                    'lineWidth': 70
                },
                'rokuLog': {
                    'strip': false,
                    'insertPkgPath': true
                },
                'sourceMap': true
            };
            let programBuilder = new ProgramBuilder();
            programBuilder.run(config as any).catch(e => {
                console.error(e);
            });

        });
    });


    describe('auto inject m into namespace function call support', () => {
        beforeEach(() => {
            plugin.maestroConfig.updateAsFunctionCalls = true;
        });

        it('does nothing if the function is not marked with @injectLocalM ', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                namespace test.ns
                    function nsFunc(name, mTarget = invalid)
                    end function
                end namespace
                function main()
                    a = test.ns.nsFunc("hello")
                    print test.ns.nsFunc("hello")
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function test_ns_nsFunc(name, mTarget = invalid)
                end function

                function main()
                    a = test_ns_nsFunc("hello")
                    print test_ns_nsFunc("hello")
                end function
            `);
        });

        it('does nothing if the function is @injectLocalM; but all args are present', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                namespace test.ns
                    @injectLocalM
                    function nsFunc(name, mTarget = invalid)
                    end function
                end namespace
                function main()
                    a = test.ns.nsFunc("hello", {})
                    print test.ns.nsFunc("hello", {})
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function test_ns_nsFunc(name, mTarget = invalid)
                end function

                function main()
                    a = test_ns_nsFunc("hello", {})
                    print test_ns_nsFunc("hello", {})
                end function
            `);
        });

        it('injects m, @injectLocalM is present', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                namespace test.ns
                    @injectLocalM
                    function nsFunc(name, mTarget = invalid)
                    end function
                end namespace
                function main()
                    a = test.ns.nsFunc("hello")
                    print test.ns.nsFunc("hello")
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function test_ns_nsFunc(name, mTarget = invalid)
                end function

                function main()
                    a = test_ns_nsFunc("hello", m)
                    print test_ns_nsFunc("hello", m)
                end function
            `);
        });

        it('adds default values, if function has more params', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                namespace test.ns
                    @injectLocalM
                    function nsFunc(name, arg1 = "mark", arg2 = invalid, arg3 = [], arg4 = 123, mTarget = invalid)
                    end function
                end namespace
                function main()
                    a = test.ns.nsFunc("oh hi")
                    print test.ns.nsFunc("oh hi")
                    a = test.ns.nsFunc("oh hi", "lisa")
                    print test.ns.nsFunc("oh hi", "lisa")
                    print test.ns.nsFunc("oh hi", "lisa", ["first"])
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function test_ns_nsFunc(name, arg1 = "mark", arg2 = invalid, arg3 = [], arg4 = 123, mTarget = invalid)
                end function

                function main()
                    a = test_ns_nsFunc("oh hi", "mark", invalid, [], 123, m)
                    print test_ns_nsFunc("oh hi", "mark", invalid, [], 123, m)
                    a = test_ns_nsFunc("oh hi", "lisa", invalid, [], 123, m)
                    print test_ns_nsFunc("oh hi", "lisa", invalid, [], 123, m)
                    print test_ns_nsFunc("oh hi", "lisa", [
                        "first"
                    ], [], 123, m)
                end function
            `);
        });
        it('works for function expression calls', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                namespace test.ns
                    @injectLocalM
                    function nsFunc(name, arg1 = "mark", arg2 = invalid, arg3 = [], arg4 = 123, mTarget = invalid)
                    end function
                    function printThing(text)
                    end function
                end namespace
                function main()
                    a = m.toStr(test.ns.nsFunc("oh hi"))
                    print m.toStr(test.ns.nsFunc("oh hi"))
                    test.ns.printThing(test.ns.nsFunc("oh hi"))
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function test_ns_nsFunc(name, arg1 = "mark", arg2 = invalid, arg3 = [], arg4 = 123, mTarget = invalid)
                end function

                function test_ns_printThing(text)
                end function

                function main()
                    a = m.toStr(test_ns_nsFunc("oh hi", "mark", invalid, [], 123, m))
                    print m.toStr(test_ns_nsFunc("oh hi", "mark", invalid, [], 123, m))
                    test_ns_printThing(test_ns_nsFunc("oh hi", "mark", invalid, [], 123, m))
                end function
            `);
        });
    });
    describe('as support', () => {
        beforeEach(() => {
            plugin.maestroConfig.updateAsFunctionCalls = true;
        });

        it('converts as calls in regular functions into mc_getXXX', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                function notInClass()
                    m.expectOnce(asAA(data.Schedules[0].Productions[0]))
                    print asAA(data.Schedules[0].Productions[0])
                    formatJson(asAA(json.user))
                    print(asString(json.user.name, "default name"))
                    if asBoolean(json.user.favorites[0].isActive)
                        print mc_getInteger(json, "age.0.time." + rokucommunity_bslib_toString(thing) + ".other.this")
                    end if
                    print m.items.getValue(asArray(items, ["none"]))
                    print m.items.show(asNode(items[0].item))
                    print m.items.show(asNode(items[0].item))
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function notInClass()
                    m.expectOnce(mc_getAA(data, "Schedules.0.Productions.0"))
                    print mc_getAA(data, "Schedules.0.Productions.0")
                    formatJson(mc_getAA(json, "user"))
                    print (mc_getString(json, "user.name", "default name"))
                    if mc_getBoolean(json, "user.favorites.0.isActive")
                        print mc_getInteger(json, "age.0.time." + rokucommunity_bslib_toString(thing) + ".other.this")
                    end if
                    print m.items.getValue(mc_getArray(items, invalid, [
                        "none"
                    ]))
                    print m.items.show(mc_getNode(items, "0.item"))
                    print m.items.show(mc_getNode(items, "0.item"))
                end function
            `);
        });

        it('supports dereferencing of variables', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                function notInClass()
                    ? index
                    a = asAA(data.Schedules[index].Productions[m.index]))
                end function
            `);
            program.validate();
            await builder.build();

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
            function notInClass()
                ? index
                a = mc_getAA(data, "Schedules." + rokucommunity_bslib_toString(index) + ".Productions." + rokucommunity_bslib_toString(m.index) + "")
            end function`);
        });

        it('converts asNode to mc_getAny, when transpileAsNodeAsAny is present', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            plugin.maestroConfig.transpileAsNodeAsAny = true;
            program.setFile('source/comp.bs', `
                function notInClass()
                    m.expectOnce(asAA(data.Schedules[0].Productions[0]))
                    print asNode(data.Schedules[0].Productions[0])
                    formatJson(asAA(json.user))
                    print(asString(json.user.name, "default name"))
                    if asBoolean(json.user.favorites[0].isActive)
                        print asInteger(json.age[0].time[thing].other["this"])
                    end if
                    print m.items.getValue(asArray(items, ["none"]))
                    print m.items.show(asNode(items[0].item))
                    print m.items.show(asNode(items[0].item))
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function notInClass()
                    m.expectOnce(mc_getAA(data, "Schedules.0.Productions.0"))
                    print mc_getAny(data, "Schedules.0.Productions.0")
                    formatJson(mc_getAA(json, "user"))
                    print (mc_getString(json, "user.name", "default name"))
                    if mc_getBoolean(json, "user.favorites.0.isActive")
                        print mc_getInteger(json, "age.0.time." + rokucommunity_bslib_toString(thing) + ".other.this")
                    end if
                    print m.items.getValue(mc_getArray(items, invalid, [
                        "none"
                    ]))
                    print m.items.show(mc_getAny(items, "0.item"))
                    print m.items.show(mc_getAny(items, "0.item"))
                end function
            `);
        });

        it('ignores asXXX calls in that do not start with as_XXX', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                function notInClass()
                    formatJson(fw_asAA(json.user))
                    print(fw_asString(json.user.name, "default name"))
                    if asBoolean(json.user.favorites[0].isActive)
                        print fw_asInteger(json.age[0].time[thing].other["this"])
                    end if
                    print m.items.getValue(fw_asArray(items, ["none"]))
                    print m.items.show(fw_asNode(items[0].item))
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function notInClass()
                    formatJson(fw_asAA(json.user))
                    print (fw_asString(json.user.name, "default name"))
                    if mc_getBoolean(json, "user.favorites.0.isActive")
                        print fw_asInteger(json.age[0].time[thing].other["this"])
                    end if
                    print m.items.getValue(fw_asArray(items, [
                        "none"
                    ]))
                    print m.items.show(fw_asNode(items[0].item))
                end function
            `);
        });

        it('fails validations if a method invocation is present in an as call', () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                function notInClass()
                    print(asString(json.user.getValue().name, "default name"))
                    formatJson(asAA(json.getName()))
                    if asBoolean(json.user.getfavorites().isActive)
                        print asInteger(json.age[0].time[thing].get().other["this"])
                    end if
                end function
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 1001);
            expect(d).to.have.lengthOf(4);
            expect(d[0].code).to.equal('MSTO1058');
            expect(d[0].message).to.equal('Cannot call function inside an as expression. Function called: "getValue"');
            expect(d[1].code).to.equal('MSTO1058');
            expect(d[1].message).to.equal('Cannot call function inside an as expression. Function called: "getName"');
            expect(d[2].code).to.equal('MSTO1058');
            expect(d[2].message).to.equal('Cannot call function inside an as expression. Function called: "getfavorites"');
            expect(d[3].code).to.equal('MSTO1058');
            expect(d[3].message).to.equal('Cannot call function inside an as expression. Function called: "get"');
        });

        it('fails validations if a callfunc invocation is present in an as call', () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                function notInClass()
                    print(asString(json.user@.getValue().name, "default name"))
                    formatJson(asAA(json@.getName()))
                    if asBoolean(json.user@.getfavorites().isActive)
                        print asInteger(json.age[0].time[thing]@.get().other["this"])
                    end if
                end function
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 1001);
            expect(d).to.have.lengthOf(4);
            expect(d[0].code).to.equal('MSTO1058');
            expect(d[0].message).to.equal('Cannot call function inside an as expression. Function called: "getValue"');
            expect(d[1].code).to.equal('MSTO1058');
            expect(d[1].message).to.equal('Cannot call function inside an as expression. Function called: "getName"');
            expect(d[2].code).to.equal('MSTO1058');
            expect(d[2].message).to.equal('Cannot call function inside an as expression. Function called: "getfavorites"');
            expect(d[3].code).to.equal('MSTO1058');
            expect(d[3].message).to.equal('Cannot call function inside an as expression. Function called: "get"');
        });

        it('converts as calls in namespace functions', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                namespace ns
                    function inNAmespace()
                        formatJson(asAA(json.user))
                        if asBoolean(json.user.favorites[0].isActive)
                            print asInteger(json.age[0].time[thing].other["this"])
                        end if
                        print m.items.getValue(asArray(items))
                        print m.items.show(asNode(items[0].item))
                    end function
                end namespace
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function ns_inNAmespace()
                    formatJson(mc_getAA(json, "user"))
                    if mc_getBoolean(json, "user.favorites.0.isActive")
                        print mc_getInteger(json, "age.0.time." + rokucommunity_bslib_toString(thing) + ".other.this")
                    end if
                    print m.items.getValue(mc_getArray(items, invalid))
                    print m.items.show(mc_getNode(items, "0.item"))
                end function
            `);
        });

        it('converts as calls in class functions', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    private json
                    function classMethod()
                        formatJson(asAA(m.json.user))
                        if asBoolean(m.json.user.favorites[0].isActive)
                            print mc_getInteger(m, "json.age.0.time." + rokucommunity_bslib_toString(thing) + ".other.this")
                        end if
                        print m.items.getValue(asArray(items))
                        print m.items.show(asNode(items[0].item))
                    end function
                end class
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function __Comp_builder()
                    instance = {}
                    instance.new = sub()
                        m.json = invalid
                        m.__classname = "Comp"
                    end sub
                    instance.classMethod = function()
                        formatJson(mc_getAA(m, "json.user"))
                        if mc_getBoolean(m, "json.user.favorites.0.isActive")
                            print mc_getInteger(m, "json.age.0.time." + rokucommunity_bslib_toString(thing) + ".other.this")
                        end if
                        print m.items.getValue(mc_getArray(items, invalid))
                        print m.items.show(mc_getNode(items, "0.item"))
                    end function
                    return instance
                end function
                function Comp()
                    instance = __Comp_builder()
                    instance.new()
                    return instance
                end function
            `);
        });

        it('supports simple types', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                function notInClass()
                    print asAA(data)
                    print asAA(data, {id:"default"})
                    formatJson(asAA(json))
                    print(asString(name))
                    print(asString(name, "default name"))
                    if asBoolean(isActive)
                        print asInteger(numSeconds, -1)
                        print asNumber(numSeconds, -1)
                        print asLong(numSeconds, -1)
                    end if
                    print m.items.getValue(asArray(items))
                    print m.items.show(asArray(items, ["first"]))
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
            function notInClass()
                print mc_getAA(data, invalid)
                print mc_getAA(data, invalid, {
                    id: "default"
                })
                formatJson(mc_getAA(json, invalid))
                print (mc_getString(name, invalid))
                print (mc_getString(name, invalid, "default name"))
                if mc_getBoolean(isActive, invalid)
                    print mc_getInteger(numSeconds, invalid, -1)
                    print mc_getNumber(numSeconds, invalid, -1)
                    print mc_getLong(numSeconds, invalid, -1)
                end if
                print m.items.getValue(mc_getArray(items, invalid))
                print m.items.show(mc_getArray(items, invalid, [
                    "first"
                ]))
            end function
            `);
        });
    });

    describe('observe substitution support', () => {
        beforeEach(() => {
            plugin.maestroConfig.updateAsFunctionCalls = true;
            plugin.maestroConfig.updateObserveCalls = true;
        });

        it('does nothing outside of a class', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                function notInClass()
                    m.observe(node.field, m.callbackFunction)
                    m.observe(m.node.field, m.callbackFunction)
                    m.observe(m.nodes[0].field, m.callbackFunction)
                    m.observe(m.nodes["indexed"].field, m.callbackFunction)
                    m.observe(m.nodes["indexed"].field, m.callbackFunction)
                end function
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function notInClass()
                    m.observe(node.field, m.callbackFunction)
                    m.observe(m.node.field, m.callbackFunction)
                    m.observe(m.nodes[0].field, m.callbackFunction)
                    m.observe(m.nodes["indexed"].field, m.callbackFunction)
                    m.observe(m.nodes["indexed"].field, m.callbackFunction)
                end function
            `);
        });

        it('does not update observeNodeField', async () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    function notInClass()
                        m.observeNodeField(node, "field", m.callbackFunction)
                        m.observeNodeField(m.node, "field", m.callbackFunction)
                        m.observeNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                    end function
                end class
            `);
            program.validate();
            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function __Comp_builder()
                    instance = {}
                    instance.new = sub()
                        m.__classname = "Comp"
                    end sub
                    instance.notInClass = function()
                        m.observeNodeField(node, "field", m.callbackFunction)
                        m.observeNodeField(m.node, "field", m.callbackFunction)
                        m.observeNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                    end function
                    return instance
                end function
                function Comp()
                    instance = __Comp_builder()
                    instance.new()
                    return instance
                end function
            `);
        });

        it('fails validations if field name is not present', () => {
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    private json
                    function classMethod()
                        m.observe(m.node, m.callbackFunction)
                        m.observe(node, m.callbackFunction)
                        m.observe(m.nodes[0], m.callbackFunction)
                        m.observe(m.nodes["indexed"], m.callbackFunction)
                        m.observe(m.validNode.chained[0].invalidCall(), m.callbackFunction)
                        m.observe(node.invalidCall(), m.callbackFunction)
                        m.unobserve(m.node.field, m.callbackFunction)
                        m.unobserve(m.nodes[0].field, m.callbackFunction)
                        m.unobserve(m.nodes["indexed"].field, m.callbackFunction)
                        m.unobserve(m.nodes["indexed"].field, m.callbackFunction)
                        m.unobserve(node.invalidCall(), m.callbackFunction)
                    end function
                end class
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 'MSTO1040' && d.code !== 1001);
            expect(d).to.have.lengthOf(6);
            expect(d[0].code).to.equal('MSTO1061');
            expect(d[1].code).to.equal('MSTO1059');
            expect(d[2].code).to.equal('MSTO1059');
            expect(d[3].code).to.equal('MSTO1059');
            expect(d[4].code).to.equal('MSTO1059');
            expect(d[5].code).to.equal('MSTO1059');
        });

        it('gives diagnostics when observe function does not exist', () => {
            plugin.maestroConfig.extraValidation.doExtraValidation = true;
            plugin.maestroConfig.extraValidation.doExtraImportValidation = true;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
            class Comp
            private json
            function classMethod()
            m.observe(node.field, m.callbackFunction)
            end function
            end class
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 'MSTO1040' && d.code !== 1001);
            expect(d).to.have.lengthOf(1);
            expect(d[0].code).to.equal('MSTO1062');
        });
        it('gives diagnostics when observe function does takes wrong number of params - no param function', () => {
            plugin.maestroConfig.extraValidation.doExtraValidation = true;
            plugin.maestroConfig.extraValidation.doExtraImportValidation = true;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    private json
                    function classMethod()
                        m.observe(node.field, m.callbackFunction)
                        m.observe(node.field, m.callbackFunction, "both")
                        m.observe(node.field, m.callbackFunction, "node")
                        m.observe(node.field, m.callbackFunction, "value")
                    end function
                    function callbackFunction()
                    end function
                end class
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 'MSTO1040' && d.code !== 1001);
            expect(d).to.have.lengthOf(4);
            expect(d[0].code).to.equal('MSTO1063');
            expect(d[1].code).to.equal('MSTO1063');
            expect(d[2].code).to.equal('MSTO1063');
            expect(d[3].code).to.equal('MSTO1063');
        });
        it('gives diagnostics when observe function does takes wrong number of params - 1 param function', () => {
            plugin.maestroConfig.extraValidation.doExtraValidation = true;
            plugin.maestroConfig.extraValidation.doExtraImportValidation = true;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    private json
                    function classMethod()
                        m.observe(node.field, m.callbackFunction)
                        m.observe(node.field, m.callbackFunction, "both")
                        m.observe(node.field, m.callbackFunction, "node")
                        m.observe(node.field, m.callbackFunction, "value")
                    end function
                    function callbackFunction(value)
                    end function
                end class
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 'MSTO1040' && d.code !== 1001);
            expect(d).to.have.lengthOf(1);
            expect(d[0].code).to.equal('MSTO1063');
        });
        it('gives diagnostics when observe function does takes wrong number of params - 2 param function', () => {
            plugin.maestroConfig.extraValidation.doExtraValidation = true;
            plugin.maestroConfig.extraValidation.doExtraImportValidation = true;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    private json
                    function classMethod()
                        m.observe(node.field, m.callbackFunction)
                        m.observe(node.field, m.callbackFunction, "both")
                        m.observe(node.field, m.callbackFunction, "node")
                        m.observe(node.field, m.callbackFunction, "value")
                    end function
                    function callbackFunction(value, node)
                    end function
                end class
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 'MSTO1040' && d.code !== 1001);
            expect(d).to.have.lengthOf(3);
            expect(d[0].code).to.equal('MSTO1063');
            expect(d[0].code).to.equal('MSTO1063');
            expect(d[0].code).to.equal('MSTO1063');
        });


        it('converts observe calls in class functions when validations are enabled', async () => {
            plugin.maestroConfig.extraValidation.doExtraValidation = true;
            plugin.maestroConfig.extraValidation.doExtraImportValidation = true;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    private json
                    function classMethod()
                        m.observe(node.field, m.callbackFunction)
                        m.observe(m.node.field, m.callbackFunction)
                        m.observe(m.nodes[0].field, m.callbackFunction)
                        m.observe(m.nodes["indexed"].field, m.callbackFunction)
                        m.observe(m.nodes["indexed"].field, m.callbackFunction)
                        m.observe(getNode("").field, m.callbackFunction)
                        m.observe(m.getNode().field, m.callbackFunction)
                        m.observe(m.getNode("id").field, m.callbackFunction)
                        m.observe(getNode("id").field, m.callbackFunction)
                        m.unobserve(node.field, m.callbackFunction)
                        m.unobserve(m.node.field, m.callbackFunction)
                        m.unobserve(m.nodes[0].field, m.callbackFunction)
                        m.unobserve(m.nodes["indexed"].field, m.callbackFunction)
                        m.unobserve(m.nodes["indexed"].field, m.callbackFunction)
                        m.unobserve(m.getNode().field, m.callbackFunction)
                        m.unobserve(m.getNode("id").field, m.callbackFunction)
                        m.unobserve(getNode("id").field, m.callbackFunction)
                    end function
                    function callbackFunction(value)
                    end function
                end class
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 'MSTO1040' && d.code !== 1001);
            expect(d).to.have.lengthOf(0);

            await builder.build();
            //ignore diagnostics - need to import core

            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function __Comp_builder()
                    instance = {}
                    instance.new = sub()
                        m.json = invalid
                        m.__classname = "Comp"
                    end sub
                    instance.classMethod = function()
                        m.observeNodeField(node, "field", m.callbackFunction)
                        m.observeNodeField(m.node, "field", m.callbackFunction)
                        m.observeNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.observeNodeField(getNode(""), "field", m.callbackFunction)
                        m.observeNodeField(m.getNode(), "field", m.callbackFunction)
                        m.observeNodeField(m.getNode("id"), "field", m.callbackFunction)
                        m.observeNodeField(getNode("id"), "field", m.callbackFunction)
                        m.unobserveNodeField(node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(m.getNode(), "field", m.callbackFunction)
                        m.unobserveNodeField(m.getNode("id"), "field", m.callbackFunction)
                        m.unobserveNodeField(getNode("id"), "field", m.callbackFunction)
                    end function
                    instance.callbackFunction = function(value)
                    end function
                    return instance
                end function
                function Comp()
                    instance = __Comp_builder()
                    instance.new()
                    return instance
                end function
            `);
        });

        it('converts observe calls in class functions', async () => {
            plugin.maestroConfig.extraValidation.doExtraValidation = false;
            plugin.maestroConfig.extraValidation.doExtraImportValidation = false;
            plugin.afterProgramCreate({ program: program } as AfterProgramCreateEvent);
            program.setFile('source/comp.bs', `
                class Comp
                    private json
                    function classMethod()
                        m.observe(node.field, m.callbackFunction)
                        m.observe(m.node.field, m.callbackFunction)
                        m.observe(m.nodes[0].field, m.callbackFunction)
                        m.observe(m.nodes["indexed"].field, m.callbackFunction)
                        m.observe(m.nodes["indexed"].field, m.callbackFunction)
                        m.observe(getNode("").field, m.callbackFunction)
                        m.observe(m.getNode().field, m.callbackFunction)
                        m.observe(m.getNode("id").field, m.callbackFunction)
                        m.observe(getNode("id").field, m.callbackFunction)
                        m.unobserve(node.field, m.callbackFunction)
                        m.unobserve(m.node.field, m.callbackFunction)
                        m.unobserve(m.nodes[0].field, m.callbackFunction)
                        m.unobserve(m.nodes["indexed"].field, m.callbackFunction)
                        m.unobserve(m.nodes["indexed"].field, m.callbackFunction)
                        m.unobserve(m.getNode().field, m.callbackFunction)
                        m.unobserve(m.getNode("id").field, m.callbackFunction)
                        m.unobserve(getNode("id").field, m.callbackFunction)
                    end function
                end class
            `);
            program.validate();
            let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && d.code !== 'MSTO1040' && d.code !== 1001);
            expect(d).to.have.lengthOf(0);

            await builder.build();
            //ignore diagnostics - need to import core
            expect(
                undent(getContents('source/comp.brs'))
            ).to.eql(undent`
                function __Comp_builder()
                    instance = {}
                    instance.new = sub()
                        m.json = invalid
                        m.__classname = "Comp"
                    end sub
                    instance.classMethod = function()
                        m.observeNodeField(node, "field", m.callbackFunction)
                        m.observeNodeField(m.node, "field", m.callbackFunction)
                        m.observeNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.observeNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.observeNodeField(getNode(""), "field", m.callbackFunction)
                        m.observeNodeField(m.getNode(), "field", m.callbackFunction)
                        m.observeNodeField(m.getNode("id"), "field", m.callbackFunction)
                        m.observeNodeField(getNode("id"), "field", m.callbackFunction)
                        m.unobserveNodeField(node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.node, "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes[0], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(m.nodes["indexed"], "field", m.callbackFunction)
                        m.unobserveNodeField(m.getNode(), "field", m.callbackFunction)
                        m.unobserveNodeField(m.getNode("id"), "field", m.callbackFunction)
                        m.unobserveNodeField(getNode("id"), "field", m.callbackFunction)
                    end function
                    return instance
                end function
                function Comp()
                    instance = __Comp_builder()
                    instance.new()
                    return instance
                end function
            `);
        });
    });

});

function getContents(filename: string) {
    let name = path.join(_stagingFolderPath, filename);
    return fsExtra.readFileSync(name).toString();
}

function assertHasDiagnostic(builder: ProgramBuilder, code: string, severity = DiagnosticSeverity.Error, count = 1, isOnly = true) {
    expect(builder.getDiagnostics().filter((d) => d.severity === severity && d.code === code).length).to.equal(count);
    if (isOnly) {
        expect(builder.getDiagnostics().filter((d) => d.severity === severity).length).to.equal(1);
    }
}

function checkDiagnostic(d: BsDiagnostic, expectedCode: number, line?: number) {
    expect(d.code).is.equal(`MSTO${expectedCode}`);
    if (line) {
        expect(d.range.start.line).is.equal(line);
    }
}


