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
