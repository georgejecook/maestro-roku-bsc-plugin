// eslint-disable-next-line
const path = require('path');
// eslint-disable-next-line


let swv = {
    'stagingFolderPath': 'build',
    'rootDir': '/home/george/hope/open-source/maestro/swerve-app/src',
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
        ]
    },
    'rooibos': {
        'isRecordingCodeCoverage': false,
        'testsFilePattern': null
    },
    'logLevel': 'error'
};

const ProgramBuilder = require('brighterscript').ProgramBuilder;

// let config = {
//     'rootDir': '/home/george/hope/applicaster/zapp-roku-app/src',
//     'stagingFolderPath': '/home/george/hope/applicaster/zapp-roku-app/build',
//     'retainStagingFolder': true,
//     'createPackage': false,
//     'autoImportComponentScript': true,
//     'files': [
//         'manifest',
//         'source/**/*.*',
//         'components/**/*.*',
//         'images/**/*.*',
//         {
//             'src': '../external/plugins-src/**/*.*',
//             'dest': ''
//         },
//         {
//             'src': '../external/plugins-core-src/**/*.*',
//             'dest': ''
//         },
//         {
//             'src': '../external/private-emmys-src/**/*.*',
//             'dest': ''
//         },
//         {
//             'src': '../external/private-oc-src/**/*.*',
//             'dest': ''
//         },
//         {
//             'src': '!../external/plugins-src/**/*.spec.bs',
//             'dest': ''
//         },
//         {
//             'src': '!../external/plugins-core-src/**/*.spec.*',
//             'dest': ''
//         },
//         {
//             'src': '!../external/private-emmys-src/**/*.spec.*',
//             'dest': ''
//         },
//         {
//             'src': '!../external/private-oc-src/**/*.spec.*',
//             'dest': ''
//         },
//         '!**/*.spec.bs'
//     ],
//     'diagnosticFilters': [
//         {
//             'src': '**/roku_modules/**/*.*',
//          0sc'codes': [
//                 1107,
//                 1009,
//                 1001,
//                 1067
//             ]
//         },
//         {
//             'src': '**/Whitelist.xml',
//             'codes': [
//                 1067
//             ]
//         },
//         {
//             'src': 'components/maestro/generated/**/*.*',
//             'codes': [
//                 1001
//             ]
//         },
//         1013,
//         {
//             'src': '../external/plugins-src/components/YouboraAnalytics/*.*'
//         },
//         {
//             'src': '../external/plugins-src/components/segment_analytics/*.*'
//         },
//         {
//             'src': '../external/plugins-src/source/segment_analytics/SegmentAnalytics.brs'
//         },
//         {
//             'src': '**/RALETrackerTask.*'
//         }
//     ],
//     'plugins': [
//         '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js'
//     ],
//     'rooibos': {
//         'isRecordingCodeCoverage': false,
//         'testsFilePattern': null
//     },
//     'maestro': {
//         'buildTimeImports': {
//             'IAuthProvider': [
//                 'pkg:/source/inplayer_auth_plugin_roku/InPlayerAuthPlugin.bs'
//             ],
//             'IEntitlementsProvider': [
//                 'pkg:/source/inplayer_entitlements_plugin/InPlayerEntitlementsPlugin.bs'
//             ],
//             'IBookmarksProvider': [],
//             'IPlayerAnalytics': [],
//             'IAnalytics': [
//                 'pkg:/source/google_analytics_roku/GoogleAnalyticsPlugin.bs'
//             ]
//         }
//     },
//     'rokuLog': {
//         'strip': false,
//         'insertPkgPath': true
//     },
//     'sourceMap': true
// };

//mv
// let config = {
//     'rootDir': '/home/george/hope/open-source/maestro/maestro-roku-view/src',
//     'files': [
//         'manifest',
//         'source/**/*.*',
//         'components/**/*.*'
//     ],
//     'autoImportComponentScript': true,
//     'createPackage': false,
//     'stagingFolderPath': 'build',
//     'diagnosticFilters': [
//         {
//             'src': '**/roku_modules/**/*.*'
//         },
//         {
//             'src': '**/WhiteList.xml',
//             'codes': [
//                 1067
//             ]
//         },
//         1120
//     ],
//     'emitDefinitions': true,
//     'plugins': [
//         '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
//         '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
//     ],
//     'rooibos': {
//         'isRecordingCodeCoverage': false,
//         'testsFilePattern': null,
//         'tags': [
//             '!integration',
//             '!deprecated',
//             '!fixme'
//         ],
//         'showOnlyFailures': true,
//         'catchCrashes': true,
//         'lineWidth': 70
//     },
//     'rokuLog': {
//         'strip': false,
//         'insertPkgPath': true
//     },
//     'sourceMap': true
// };

//mc
let mc = {
    'rootDir': '/home/george/hope/open-source/maestro/maestro-roku-core/src',
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
programBuilder.run(
    swv
    // mc
    // {
    // project: '/home/george/hope/open-source/maestro/swerve-app/bsconfig.json'
    // project: path.join(__dirname, '../', 'test-project', 'bsconfig.json')
    // }
).catch(e => {
    console.error(e);
});

