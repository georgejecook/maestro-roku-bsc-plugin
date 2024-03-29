// eslint-disable-next-line
const path = require('path');
// eslint-disable-next-line

let zapp = {
    'rootDir': '/home/george/hope/applicaster/zapp-roku-app/src',
    'stagingFolderPath': 'build',
    'retainStagingFolder': true,
    'createPackage': false,
    'autoImportComponentScript': true,
    'files': [
        'manifest',
        'source/**/*.*',
        'components/**/*.*',
        'images/**/*.*',
        '!**/*.md',
        '!asset-bundle/__MACOSX',
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
        }
    ],
    'diagnosticFilters': [
        {
            'src': '**/roku_modules/**/*.*',
            'codes': [1107, 1009, 1001, 1067]
        },
        {
            'src': '**/Whitelist.xml',
            'codes': [1067]
        },
        {
            'src': 'components/maestro/generated/**/*.*',
            'codes': [1001]
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
        },
        {
            'src': '../external/plugins-src/source/google_analytics_roku/*.*'
        },
        {
            'src': 'source/lib/rokuPromise.bs'
        },
        {
            'src': '../external/plugins-src/components/google_analytics_roku/*.*'
        },
        {
            'src': '**/roku_modules/**/*.*'
        },
        {
            'src': '**/*spec.bs',
            'codes': ['LINT3011']
        },
        1129,
        1128

    ],
    'plugins': [
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/maestro/roku-log-bsc-plugin/dist/plugin.js'
    ],
    'rooibos': {
        'isRecordingCodeCoverage': false,
        'testsFilePattern': null
    },
    'maestro': {
        'nodeClasses': {
            'buildForIDE': false,
            'generateTestUtils': false
        },
        'excludeFilters': [
            '**/roku_modules/**/*',
            '**/rooibos-roku/**/*'
        ],
        'mvvm': {
            'insertXmlBindingsEarly': false,
            'createCodeBehindFilesWhenNeeded': false,
            'insertCreateVMMethod': false,
            'callCreateVMMethodInInit': false,
            'callCreateNodeVarsInInit': true
        },
        'buildTimeImports': {
            'IAuthProvider': [
                'pkg:/source/zapp_oauth_plugin/ZappOauthPlugin.bs',
                'pkg:/source/AdobeAccessEnabler/AdobePrimetimeAuthPlugin.bs',
                'pkg:/source/cleeng_auth_provider/CleengAuthPlugin.bs'
            ],
            'IEntitlementsProvider': [
                'pkg:/source/cleeng_entitlements_plugin/CleengEntitlementsPlugin.bs'
            ],
            'IBookmarksProvider': [],
            'IPlayerAnalytics': [
                'pkg:/source/google_analytics_roku/GoogleAnalyticsPlugin.bs'
            ],
            'IAnalytics': [
                'pkg:/source/google_analytics_roku/GoogleAnalyticsPlugin.bs'
            ],
            'IBootstrapPlugin': []
        },
        'reflection': {
            'generateReflectionFunctions': true,
            'excludeFilters': [
                '**/roku_modules/**/*',
                '**/*.spec.bs'
            ]
        },
        'extraValidation': {
            'doExtraValidation': true,
            'doExtraImportValidation': false
        }
    },
    'rokuLog': {
        'strip': false,
        'insertPkgPath': true,
        'removeComments': true
    },
    'sourceMap': true
};
let z41 = {
    'rootDir': '/home/george/hope/applicaster/4-1/zapp-roku-app/src',
    'stagingFolderPath': 'build',
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
                'pkg:/source/zapp_oauth_plugin/ZappOAuthPlugin.bs'
            ],
            'IEntitlementsProvider': [
                'pkg:/source/simple_entitlements_roku/SimpleEntitlementsPlugin.bs'
            ],
            'IBookmarksProvider': [],
            'IPlayerAnalytics': [],
            'IAnalytics': []
        },
        'mvvm': {
            'insertXmlBindingsEarly': false,
            'createCodeBehindFilesWhenNeeded': false,
            'insertCreateVMMethod': false,
            'callCreateVMMethodInInit': false,
            'callCreateNodeVarsInInit': false
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
    'stagingFolderPath': 'build',
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
            '**/rooibos/**/*'
        ],
        'buildTimeImports': {
            'IAuthProvider': [],
            'IEntitlementsProvider': [],
            'IBookmarksProvider': [],
            'IPlayerAnalytics': [],
            'IAnalytics': [],
            'IBootstrapPlugin': []
        }
    },
    'rokuLog': {
        'strip': false,
        'insertPkgPath': true,
        'removeComments': true
    },
    'sourceMap': true
};
//maestro list
let maestroList = {
    'rootDir': '/home/george/hope/open-source/maestro/maestro-roku-list/src',
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
            'src': '**/rooibos/**/*.*'
        },
        {
            'src': '**/rooibos-roku/**/*.*'
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
        'excludeFilters': ['**/roku_modules/**/*', '**/rooibos/**/*', '**/rooibos-roku/**/*'],
        'buildForIDE': false
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
        'nodeClasses': {
            'buildForIDE': false,
            'generateTestUtils': true
        }
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


let robot = {
    'stagingFolderPath': 'build',
    'rootDir': '/home/george/hope/tw/roku-robot/src',
    'extends': '/home/george/hope/tw/roku-robot/bsconfig.json',
    'files': [
        '!**/*.i8n.json',
        'manifest',
        'source/**/*.*',
        'images/**/*.*',
        'sounds/**/*.*',
        'fonts/**/*.*',
        'components/**/*.*',
        'meta/**/*.*',
        { 'src': '../src-dev/meta/**/*.*', 'dest': 'meta' },
        { 'src': '../src-dev/source/**/*.*', 'dest': 'source' },
        { 'src': '../src-dev/images/**/*.*', 'dest': 'images' },
        '!**/*.spec.bs'
    ],
    'plugins': [
        '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
        '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
    ],
    'diagnosticFilters': [
        {
            'src': '**/roku_modules/**/*.*'
        },
        {
            'src': 'node_modules/**/*.*'
        },
        {
            'src': '**/maestro/**/*.*'
        },
        {
            'src': '**/RALETrackerTask.*'
        },
        {
            'src': '**/*spec.bs',
            'codes': ['LINT3011']
        },
        1128
    ],
    'maestro': {
        'excludeFilters': [
            '**/RALETrackerTask.*',
            '**/roku_modules/**/*',
            '**/node_modules/**/*',
            '**/rooibos/**/*'
        ],
        'buildForIDE': false,
        'extraValidation': {
            'doExtraValidation': true,
            'doExtraImportValidation': true,
            'excludeFilters': []
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
programBuilder.run(
    // swv
    zapp
    // robot
    // maestro
    // corco
    // nbaLatest
    // nba
    // z41
    // maestroSample
    // maestroList
    // {
    // project: '/home/george/hope/open-source/maestro/swerve-app/bsconfig.json'
    // project: path.join(__dirname, '../', 'test-project', 'bsconfig.json')
    // }
).catch(e => {
    console.error(e);
});

