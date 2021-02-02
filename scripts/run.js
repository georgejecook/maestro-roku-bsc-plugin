// eslint-disable-next-line
const path = require('path');
// eslint-disable-next-line
const ProgramBuilder = require('brighterscript').ProgramBuilder;

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
        }
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
        1013
    ],
    'plugins': [
        '/home/george/hope/open-source/roku-log/roku-log-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js'
    ],
    'rooibos': {
        'isRecordingCodeCoverage': false,
        'testsFilePattern': null
    },
    'maestro': {
        'buildTimeImports': {
            'IAuthProvider': [
                'pkg:/source/aws_cognito_auth_plugin/AwsCognitoAuthPlugin.bs'
            ],
            'IEntitlementsProvider': [],
            'IBookmarksProvider': [],
            'IPlayerAnalytics': [],
            'IAnalytics': []
        }
    },
    'rokuLog': {
        'strip': false,
        'insertPkgPath': true
    },
    'sourceMap': true
};


let programBuilder = new ProgramBuilder();
programBuilder.run(
    config
    // {
    // project: '/home/george/hope/open-source/maestro/swerve-app/bsconfig.json'
    // project: path.join(__dirname, '../', 'test-project', 'bsconfig.json')
    // }
).catch(e => {
    console.error(e);
});
