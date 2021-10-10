'use strict';

const url = require('url')
const fs = require('fs')

const logger = require('./logger')();


require('dotenv').config()

/**
 * Читает директорию и возвращает список ее файлов
 *
 * @param dir
 * @returns {Promise.<Array>}
 */
async function listDir(dir) {
    let files = []
    try {
        files = await fs.promises.readdir(dir)
    } catch (e) {
        logger.error('Ошибка чтения директории ' + dir, e);
    }
    return files
}
module.exports.listDir = listDir;

/**
 *
 * @param pattern
 * @param url
 * @returns {any}
 */
const getParamsFromQuery = (pattern, url) => {
    const re = new RegExp(pattern.replace(/\{([^\}]+)\}/g, '(?<$1>[^\/]+)'))
    const matches = re.exec(url)
    return matches !== null ? matches.groups : null
}

module.exports.getParamsFromQuery = getParamsFromQuery;

/**
 *
 * @param ctx
 * @param args
 * @returns {*}
 */
const getArgsFromQueryParams = (ctx, args) => {
    args = args || []
    const queryData = url.parse(ctx.request.url, true).query;
    args = args.filter(k => typeof queryData[k] !== 'undefined')
    return (args || []).reduce((obj, key) => ({...obj, [key]: queryData[key]}), {})
}

module.exports.getArgsFromQueryParams = getArgsFromQueryParams;

module.exports.objectWithOnlyFields = (obj, keys) => {
    obj = obj || {}
    if ('string' === typeof keys) {
        keys = keys.split(/ +/)
    }
    return keys.reduce(function(ret, key){
        if (null === obj[key]) {
            return ret
        }
        ret[key] = obj[key]
        return ret
    }, {})
}

module.exports.objectExceptFields = (obj, keys) => {
    obj = obj || {}
    if ('string' === typeof keys) {
        keys = keys.split(/ +/)
    }
    return Object.keys(obj).reduce(function(ret, key){
        if (null === obj[key]) {
            return ret
        }
        if (keys.indexOf(key) === -1) {
            ret[key] = obj[key]
        }
        return ret
    }, {})
}

module.exports.limitArrayWithEllipsis = (a, limit) => {
    return (a.length > limit ? a.slice(0, ~~(limit / 2)).concat([{id: '...'}]).concat(a.slice(a.length - ~~(limit / 2) - limit % 2 + 1, a.length)) : a)
}
