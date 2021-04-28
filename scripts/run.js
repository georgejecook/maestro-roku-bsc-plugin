// eslint-disable-next-line
const path = require('path');
// eslint-disable-next-line

let zapp = {
    'rootDir': '/home/george/hope/applicaster/4/zapp-roku-app/src',
    'stagingFolderPath': '/home/george/hope/applicaster/4/zapp-roku-app/build',
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
            'src': '../external/plugins-src/source/segment_analytics/SegmentAnalyticsConnector.brs'
        },
        {
            'src': '**/RALETrackerTask.*'
        }
    ],
    'plugins': [
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
    ],
    'rooibos': {
        'isRecordingCodeCoverage': false,
        'testsFilePattern': null
    },
    'maestro': {
        'buildForIDE': false,
        'excludeFilters': [
            '**/roku_modules/**/*',
            '**/rooibos/**/*',
            '**/RALETrackerTask.xml'
        ],
        'buildTimeImports': {
            'IAuthProvider': [
                'pkg:/source/zapp_oauth_plugin/ZappOauthPlugin.bs'
            ],
            'IEntitlementsProvider': [
                'pkg:/source/simple_entitlements_roku/SimpleEntitlementsPlugin.bs'
            ],
            'IBookmarksProvider': [],
            'IPlayerAnalytics': [],
            'IAnalytics': []
        }
    },
    'rokuLog': {
        'strip': false,
        'insertPkgPath': true,
        'removeComments': true
    },
    'sourceMap': true
};

let swv = {
    'stagingFolderPath': 'build',
    'rootDir': '/home/george/hope/swerve/swerve-app/src',
    'autoImportComponentScript': true,
    'createPackage': false,
    'diagnosticFilters': [
        {
            'src': '**/roku_modules/**/*.*'
        },
        {
            'src': '**/Whitelist.xml',
            'codes': [
                1067
            ]
        },
        {
            'src': 'components/maestro/generated/**/*.*'
        },
        1013,
        {
            'src': '**/RALETrackerTask.*'
        }
    ],
    'files': [
        'manifest',
        'source/**/*.*',
        'images/**/*.*',
        'sounds/**/*.*',
        'fonts/**/*.*',
        'components/**/*.*',
        'meta/**/*.*'
        // '!**/*.spec.bs'
    ],
    'plugins': [
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
    ],
    'rokuLog': {
        'strip': false,
        'insertPkgPath': true
    },
    'maestro': {
        'excludeFilters': [
            '**/roku_modules/**/*',
            '**/rooibos/**/*'
        ],
        buildForIDE: false
    },
    'rooibos': {
        'isRecordingCodeCoverage': false,
        'testsFilePattern': null
    },
    'logLevel': 'error'
};

const ProgramBuilder = require('brighterscript').ProgramBuilder;

//maestro
let maestro = {
    'rootDir': '/home/george/hope/open-source/maestro/maestro-roku/src',
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
    'sourceMap': true,
    'maestro': {
        buildNodeClasses: false
    }
};
//maestro list
let maestroList = {
    'rootDir': '/home/george/hope/open-source/maestro/maestro-roku-list/src',
    'files': [
        'manifest',
        'source/**/*.*',
        'components/**/*.*',
        {
            'src': 'test-app/**/*.*',
            'dest': ''
        }
    ],
    'autoImportComponentScript': true,
    'createPackage': false,
    'stagingFolderPath': 'build',
    'diagnosticFilters': [
        {
            'src': '**/roku_modules/**/*.*'
        }
    ],
    'emitDefinitions': true,
    'plugins': [
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
    ],
    'rooibos': {
        'isRecordingCodeCoverage': false,
        'testsFilePattern': null,
        'tags': ['!integration', '!deprecated', '!fixme'],
        'showOnlyFailures': true,
        'catchCrashes': true,
        'lineWidth': 70
    },
    'sourceMap': true,
    'maestro': {
        'excludeFilters': ['**/roku_modules/**/*', '**/rooibos/**/*'],
        'buildForIDE': true
    }
};

let corco = {
    'stagingFolderPath': 'build',
    'rootDir': '/home/george/hope/miracle-channel/corco-roku/src',
    'autoImportComponentScript': true,
    'createPackage': false,
    'diagnosticFilters': [
        {
            'src': '**/roku_modules/**/*.*'
        },
        {
            'src': '**/Whitelist.xml',
            'codes': [1067]
        },
        {
            'src': '**/RALETrackerTask.*'
        }
    ],
    'rooibos': {
        'isRecordingCodeCoverage': false,
        'testsFilePattern': null
    },
    'logLevel': 'error',
    'retainStagingFolder': true,
    'extends': 'bsconfig.json',
    'files': [
        'manifest',
        'source/**/*.*',
        'images/**/*.*',
        'sounds/**/*.*',
        'fonts/**/*.*',
        'components/**/*.*',
        'meta/**/*.*',
        '!**/*.spec.bs'
    ],
    'plugins': [
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
    ],
    'rokuLog': {
        'strip': false,
        'insertPkgPath': true
    },
    'maestro': {
        'excludeFilters': ['**/roku_modules/**/*', '**/rooibos/**/*', '**/RALETrackerTask.*'],
        'buildForIDE': false
    },
    'sourceMap': true
};

let maestroSample = {
    'stagingFolderPath': 'build',
    'rootDir': '/home/george/hope/open-source/maestro/maestro-roku/sample/src',
    'files': [
        'manifest',
        'source/**/*.*',
        'images/**/*.*',
        'sounds/**/*.*',
        'sounds/*.*',
        'fonts/**/*.*',
        'meta/**/*.*',
        'components/**/*.*'
    ],
    'autoImportComponentScript': true,
    'createPackage': false,
    'diagnosticFilters': [
        {
            'src': '**/roku_modules/**/*.*'
        },
        {
            'src': '**/RALETrackerTask.*'
        }
    ],
    'plugins': [
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
    ],
    'maestro': {
        'excludeFilters': ['**/roku_modules/**/*', '**/rooibos/**/*'],
        'buildForIDE': false
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
    'retainStagingFolder': true
};

let programBuilder = new ProgramBuilder();
programBuilder.run(
    // swv
    // zapp
    // maestro
    // corco
    maestroSample
    // maestroList
    // {
    // project: '/home/george/hope/open-source/maestro/swerve-app/bsconfig.json'
    // project: path.join(__dirname, '../', 'test-project', 'bsconfig.json')
    // }
).catch(e => {
    console.error(e);
});

