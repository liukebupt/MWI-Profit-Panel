import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';
import fs from 'fs';

let last = Date.now();
const isDev = process.env.NODE_ENV === 'development';

const version = "2025.06.18";

function updateBanner() {
    if (Date.now() - last > 1000) last = Date.now();
    const banner = `// ==UserScript==
// @name         MWI Profit Panel - Dev
// @namespace    http://tampermonkey.net/
// @version      ${version}-alpha${last}
// @description  Development version of MWI Profit Panel
// @author       MengLan
// @match        https://www.milkywayidle.com/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      raw.githubusercontent.com
// @connect      ghproxy.net
// @downloadURL  http://localhost:8088/MWI-Profit-Panel.user.js
// @updateURL    http://localhost:8088/MWI-Profit-Panel.meta.js
// ==/UserScript==`

    fs.writeFileSync('dist/MWI-Profit-Panel.meta.js', banner);
    return banner;
}

const prodBanner = `// ==UserScript==
// @name         MWI Profit Panel
// @namespace    http://tampermonkey.net/
// @version      ${version}
// @description  milkywayidle游戏利润插件，在右面板添加了根据当前市场数据计算出来的收益详情，掉落记录展示了掉落详情
// @author       MengLan
// @match        https://www.milkywayidle.com/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      ghproxy.net
// @downloadURL  https://update.greasyfork.cc/scripts/536724/MWI%20Profit%20Panel.user.js
// @updateURL    https://update.greasyfork.cc/scripts/536724/MWI%20Profit%20Panel.meta.js
// @license      MIT
// ==/UserScript==`;

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/MWI-Profit-Panel.user.js',
        format: 'iife',
        banner: () => isDev ? updateBanner() : prodBanner,
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        babel({
            babelHelpers: 'bundled',
        }),
        // versionUpdatePlugin(),
    ],
    watch: {
        buildDelay: 100,
        clearScreen: false,
        skipWrite: false,
        exclude: ['node_modules/**'],
        include: ['src/**'],
    }
};