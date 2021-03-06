/**
 * Copyright (c) Areslabs.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fse from 'fs-extra'
import {getFileInfo, parseCode} from '../util/uast'
import {isStaticRes, base64Encode} from '../util/util'
import handleEntry from './handleEntry'
import handleRF from './handleRF'
import handleBF from './handleBF'

const path = require('path')
const colors = require('colors');


const RFFileList = []
let allCompSet = null
let entryFilePath = null

/**
 * 转化文件，返回转化生成的文件数组
 * @param srcpath
 * @param targetpath
 * @returns {Promise<void>}
 */
export default async function (srcpath, targetpath) {
    //如果tranComp为true，表明只是单纯的转化组件，而不是整个项目
    const tranComp = global.execArgs.tranComp

    const fsStat = await fse.stat(srcpath)
    if (fsStat.isDirectory()) {
        return []
    }

    if (srcpath.endsWith('.js') || srcpath.endsWith('.jsx')) { // js 文件需要处理
        const code = fse.readFileSync(srcpath).toString()
        const ast = parseCode(code)

        const {isEntry, isRF, isFuncComp, isRNEntry} = getFileInfo(ast)
        if (isRNEntry) return []
        targetpath = targetpath.indexOf('.jsx') > 0 ? targetpath.replace('.jsx', '.js') : targetpath
        if (isEntry && isRF) { // 入口文件 保证入口文件一定最先处理
            const entryResult = handleEntry(ast, targetpath)
            entryFilePath = entryResult.filepath
            allCompSet = entryResult.allCompSet
            for (let i = 0; i < RFFileList.length; i++) {
                const {ast, targetpath, srcpath, isFuncComp, done} = RFFileList[i]
                try {
                    const allFilepaths = handleRF(ast, targetpath, isFuncComp, entryFilePath, isPageComp(targetpath, allCompSet))
                    done(allFilepaths)
                } catch (e) {
                    console.log(colors.error(`tran ${srcpath} error ! reason: `), e)
                }
            }
            return [targetpath]
        } else if (isRF) {
            if (tranComp) {
                try {
                    return handleRF(ast, targetpath, isFuncComp, entryFilePath, false)
                } catch (e) {
                    console.log(colors.error(`tran ${srcpath} error ! reason: `), e)
                }
            } else if (entryFilePath) {
                try {
                    return handleRF(ast, targetpath, isFuncComp, entryFilePath, isPageComp(targetpath, allCompSet))
                } catch (e) {
                    console.log(colors.error(`tran ${srcpath} error ! reason: `), e)
                }
            } else {
                // 保证入口文件一定最先处理， 如果入口文件还未被处理，则把react文件先入队列
                return new Promise((resolve) => {
                    RFFileList.push({
                        ast,
                        targetpath,
                        srcpath,
                        isFuncComp,

                        done: resolve,
                    })
                })
            }
        } else {
            handleBF(ast, targetpath)
            return [targetpath]
        }
    } else { // 其他文件直接copy
        await fse.copy(srcpath, targetpath)
        return [targetpath]
    }
}

function isPageComp(targetpath, allCompSet) {
    const originPath = targetpath
        .replace(global.execArgs.OUT_DIR + path.sep, '')
        .replace('.js', '')
        .replace(/\\/g, '/') // 考虑win平台
    return allCompSet.has(originPath)
}